using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Govori.Core;

namespace Govori.Infrastructure;

/// <summary>
/// One Claude call per attempt: the structured evaluation plus the informal spoken review.
/// The system prompt is the same for every attempt, so it is marked for prompt caching.
/// </summary>
public class ClaudeEvaluator(HttpClient http, IContentProvider content, string apiKey, string model) : ISpeechEvaluator
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Joins the two editable prompts: the review rules apply only to the "review" field.</summary>
    public const string ReviewSectionHeader =
        "# Поле review — голосовое сообщение\n\n" +
        "Остальные поля заполняй по правилам выше. " +
        "Поле review — отдельный текст для озвучки, написанный после оценки и опирающийся на неё. " +
        "Итоговая оценка из 10 — это сумма твоих баллов за четыре критерия и балла за подачу из данных; " +
        "в review называй именно её. " +
        "Советуй только то, что можно сделать в следующем выступлении в приложении: никаких записей на бумаге, " +
        "заметок, диктофона и зеркала. Единственное упражнение вне выступления — устное упражнение на словарь " +
        "из поля drill, если оно есть; его можно упомянуть одной фразой. " +
        "Голос тренера женский: о себе в прошедшем времени говори в женском роде («я послушала», «мне понравилось»). " +
        "К нему относятся только правила ниже, в том числе обращение на «ты».\n\n";

    public async Task<Evaluated> EvaluateAsync(EvaluationRequest request, CancellationToken ct)
    {
        var system = await content.GetAsync(SettingKeys.EvaluationSystemPrompt, ct) + "\n\n" +
                     ReviewSectionHeader + await content.GetAsync(SettingKeys.ReviewSystemPrompt, ct);

        var body = new JsonObject
        {
            ["model"] = model,
            ["max_tokens"] = 16000,
            // Cache breakpoint at the end of the system prompt; the per-attempt data follows in the user message.
            ["system"] = new JsonArray(new JsonObject
            {
                ["type"] = "text",
                ["text"] = system,
                ["cache_control"] = new JsonObject { ["type"] = "ephemeral" },
            }),
            // Structured outputs: the reply is a text block whose JSON is guaranteed to match the schema.
            ["output_config"] = new JsonObject
            {
                ["format"] = new JsonObject { ["type"] = "json_schema", ["schema"] = Schema() },
            },
            ["messages"] = new JsonArray(new JsonObject { ["role"] = "user", ["content"] = BuildMessage(request) }),
        };

        Exception? last = null;
        for (var attempt = 0; attempt < 2; attempt++)
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
                {
                    Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
                };
                req.Headers.Add("x-api-key", apiKey);
                req.Headers.Add("anthropic-version", "2023-06-01");

                using var res = await http.SendAsync(req, ct);
                var text = await res.Content.ReadAsStringAsync(ct);
                if (!res.IsSuccessStatusCode)
                    throw new InvalidOperationException($"Claude request failed ({(int)res.StatusCode}): {text}");

                return ParseResponse(text, request.Metrics);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                last = ex;
            }
        }
        throw last!;
    }

    public static string BuildMessage(EvaluationRequest r)
    {
        var inv = CultureInfo.InvariantCulture;
        var m = r.Metrics;
        var fillers = m.FillerWords.Count == 0
            ? "нет"
            : string.Join(", ", m.FillerWords.Select(kv => $"«{kv.Key}» ×{kv.Value}"));

        var sb = new StringBuilder();
        sb.AppendLine(inv, $"Тема: {r.Topic}");
        sb.AppendLine(inv, $"Длительность: {m.DurationSec} с");
        sb.AppendLine(inv, $"Слов: {m.WordCount}, темп: {m.WordsPerMinute} слов/мин");
        sb.AppendLine(inv, $"Слова-паразиты: {fillers}");
        if (m.Vocabulary is { } v)
        {
            var repeats = v.Repeats.Count == 0 ? "нет" : string.Join(", ", v.Repeats.Select(r => $"«{r.Word}» ×{r.Count}"));
            sb.AppendLine(inv, $"Словарь (посчитан приложением): {(v.IsLow ? "однообразный" : "в норме")}, разнообразие {v.Diversity:0.00}, повторы: {repeats}");
        }
        var delivery = Delivery.Score(m);
        sb.AppendLine(inv, $"Подача (посчитана приложением): {delivery.Points}/2");
        sb.AppendLine();
        sb.AppendLine("Расшифровка:");
        sb.AppendLine(string.IsNullOrWhiteSpace(r.Transcript) ? "(пусто)" : r.Transcript);
        sb.AppendLine();

        if (r.Previous is { } p)
        {
            sb.AppendLine(inv, $"Прошлое выступление: {p.Score}/10 ({ReviewScript.ScoreTier(p.Score).ToLowerInvariant()})");
            if (p.Rubric is { } pr)
                sb.AppendLine(inv, $"Прошлые баллы: {string.Join(", ", pr.All().Select(c => $"{Names[c.Key]} {c.Criterion.Points}/2"))}");
            sb.AppendLine(inv, $"В прошлый раз советовали улучшить: {string.Join("; ", p.Improvements)}");
        }
        else
        {
            sb.AppendLine("Прошлого выступления нет — это первое.");
        }

        if (r.RecentReviews.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("Твои недавние голосовые сообщения (не повторяй их фразы и структуру):");
            foreach (var review in r.RecentReviews) sb.AppendLine(inv, $"---\n{review}");
        }
        return sb.ToString();
    }

    private static readonly Dictionary<string, string> Names = new()
    {
        ["thought"] = "главная мысль",
        ["support"] = "довод и пример",
        ["conclusion"] = "вывод",
        ["coherence"] = "цельность",
        ["delivery"] = "подача",
    };

    /// <param name="metrics">Delivery is scored from these, not by the model.</param>
    public static Evaluated ParseResponse(string responseJson, SpeechMetrics metrics)
    {
        var root = JsonNode.Parse(responseJson)!;
        var stopReason = root["stop_reason"]?.GetValue<string>();
        if (stopReason is "refusal" or "max_tokens")
            throw new InvalidOperationException($"Claude stopped with '{stopReason}'.");

        var text = root["content"]!.AsArray()
            .FirstOrDefault(c => c?["type"]?.GetValue<string>() == "text")?["text"]?.GetValue<string>()
            ?? throw new InvalidOperationException("Claude response had no text block.");

        var reply = JsonSerializer.Deserialize<Reply>(text, Json)
            ?? throw new InvalidOperationException("Empty evaluation.");
        if (reply.Thought is null || reply.Support is null || reply.Conclusion is null || reply.Coherence is null)
            throw new InvalidOperationException("Evaluation is missing required fields.");

        static Criterion Fix(ReplyCriterion c)
        {
            var points = Math.Clamp(c.Points, 0, 2);
            return new Criterion(points, c.Evidence?.Trim() ?? "", points == 2 ? "" : c.ToMax?.Trim() ?? "",
                c.Good?.Trim() ?? "");
        }

        var rubric = new Rubric(Fix(reply.Thought), Fix(reply.Support), Fix(reply.Conclusion), Fix(reply.Coherence),
            Delivery.Score(metrics));
        static List<string> One(string? s) => string.IsNullOrWhiteSpace(s) ? [] : [s.Trim()];
        static string? Quote(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        var sk = reply.Skeleton;

        var result = new EvaluationResult(
            rubric.Total, null, reply.Summary?.Trim() ?? "",
            One(reply.Strength), One(reply.Fix), One(reply.Exercise),
            rubric,
            new Skeleton(Quote(sk?.Point), Quote(sk?.Reason), Quote(sk?.Example), Quote(sk?.Conclusion)),
            // The app decides whether a drill is due; the model only writes it.
            metrics.Vocabulary is { IsLow: true } ? Quote(reply.Drill) : null,
            Synonyms(reply.Synonyms, metrics));
        return new Evaluated(result, string.IsNullOrWhiteSpace(reply.Review) ? null : reply.Review.Trim());
    }

    /// <summary>Keeps only synonyms for words the app counted as repeats, in the app's order.</summary>
    private static List<WordSynonyms>? Synonyms(List<ReplySynonyms>? reply, SpeechMetrics metrics)
    {
        if (reply is null || metrics.Vocabulary is not { Repeats.Count: > 0 } v) return null;
        var byWord = reply
            .Where(s => !string.IsNullOrWhiteSpace(s.Word))
            .GroupBy(s => s.Word!.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First().Options ?? []);
        var list = v.Repeats
            .Select(r => new WordSynonyms(r.Word,
                byWord.GetValueOrDefault(r.Word.ToLowerInvariant(), [])
                    .Select(o => o.Trim()).Where(o => o != "").Distinct().Take(3).ToList()))
            .Where(s => s.Options.Count > 0)
            .ToList();
        return list.Count == 0 ? null : list;
    }

    private sealed record ReplySynonyms(string? Word, List<string>? Options);
    private sealed record ReplyCriterion(int Points, string? Evidence, string? ToMax, string? Good = null);
    private sealed record ReplySkeleton(string? Point, string? Reason, string? Example, string? Conclusion);
    private sealed record Reply(
        ReplyCriterion? Thought, ReplyCriterion? Support, ReplyCriterion? Conclusion, ReplyCriterion? Coherence,
        ReplySkeleton? Skeleton, string? Summary, string? Strength, string? Fix, string? Exercise, string? Drill,
        string? Review, List<ReplySynonyms>? Synonyms = null);

    private static JsonObject Schema()
    {
        static JsonObject Str(string? description = null) => description is null
            ? new() { ["type"] = "string" }
            : new() { ["type"] = "string", ["description"] = description };
        static JsonObject NullableStr() => new() { ["type"] = new JsonArray("string", "null") };
        // The 0–2 range is stated in the prompt and enforced by Math.Clamp in ParseResponse.
        static JsonObject Criterion() => new()
        {
            ["type"] = "object",
            ["properties"] = new JsonObject
            {
                ["points"] = new JsonObject { ["type"] = "integer" },
                ["good"] = Str(),
                ["evidence"] = Str(),
                ["toMax"] = Str(),
            },
            ["required"] = new JsonArray("points", "good", "evidence", "toMax"),
            ["additionalProperties"] = false,
        };

        return new JsonObject
        {
            ["type"] = "object",
            ["properties"] = new JsonObject
            {
                ["thought"] = Criterion(),
                ["support"] = Criterion(),
                ["conclusion"] = Criterion(),
                ["coherence"] = Criterion(),
                ["skeleton"] = new JsonObject
                {
                    ["type"] = "object",
                    ["properties"] = new JsonObject
                    {
                        ["point"] = NullableStr(),
                        ["reason"] = NullableStr(),
                        ["example"] = NullableStr(),
                        ["conclusion"] = NullableStr(),
                    },
                    ["required"] = new JsonArray("point", "reason", "example", "conclusion"),
                    ["additionalProperties"] = false,
                },
                ["summary"] = Str("Одно предложение общего впечатления"),
                ["strength"] = Str(),
                ["fix"] = Str(),
                ["exercise"] = Str(),
                ["drill"] = Str("Упражнение на словарь, если словарь однообразный; иначе пустая строка"),
                ["synonyms"] = new JsonObject
                {
                    ["type"] = "array",
                    ["items"] = new JsonObject
                    {
                        ["type"] = "object",
                        ["properties"] = new JsonObject
                        {
                            ["word"] = Str(),
                            ["options"] = new JsonObject { ["type"] = "array", ["items"] = Str() },
                        },
                        ["required"] = new JsonArray("word", "options"),
                        ["additionalProperties"] = false,
                    },
                },
                ["review"] = Str("Голосовое сообщение тренера по правилам раздела «Поле review»"),
            },
            ["required"] = new JsonArray("thought", "support", "conclusion", "coherence", "skeleton",
                "summary", "strength", "fix", "exercise", "drill", "synonyms", "review"),
            ["additionalProperties"] = false,
        };
    }
}
