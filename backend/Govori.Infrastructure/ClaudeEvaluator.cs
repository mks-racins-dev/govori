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
        "Поля score, subScores, summary, strengths, improvements и suggestions заполняй по правилам выше. " +
        "Поле review — отдельный текст для озвучки, написанный после оценки и опирающийся на неё. " +
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

                return ParseResponse(text);
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
        sb.AppendLine();
        sb.AppendLine("Расшифровка:");
        sb.AppendLine(string.IsNullOrWhiteSpace(r.Transcript) ? "(пусто)" : r.Transcript);
        sb.AppendLine();

        if (r.Previous is { } p)
        {
            sb.AppendLine(inv, $"Прошлое выступление: {p.Score}/10 ({ReviewScript.ScoreTier(p.Score).ToLowerInvariant()})");
            sb.AppendLine(inv, $"Прошлые подоценки: {SubScores(p.SubScores)}");
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

    public static Evaluated ParseResponse(string responseJson)
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

        if (reply.SubScores is null || reply.Strengths is null || reply.Improvements is null || reply.Suggestions is null)
            throw new InvalidOperationException("Evaluation is missing required fields.");

        static int Clamp(int v) => Math.Clamp(v, 1, 10);
        var s = reply.SubScores;
        var result = new EvaluationResult(
            Clamp(reply.Score),
            new SubScores(Clamp(s.Structure), Clamp(s.Relevance), Clamp(s.Vocabulary), Clamp(s.Fluency), Clamp(s.Pace)),
            reply.Summary ?? "", reply.Strengths, reply.Improvements, reply.Suggestions);
        return new Evaluated(result, string.IsNullOrWhiteSpace(reply.Review) ? null : reply.Review.Trim());
    }

    private sealed record Reply(
        int Score, SubScores? SubScores, string? Summary,
        List<string>? Strengths, List<string>? Improvements, List<string>? Suggestions, string? Review);

    private static string SubScores(SubScores s) =>
        $"структура {s.Structure}, по теме {s.Relevance}, словарь {s.Vocabulary}, плавность {s.Fluency}, темп {s.Pace}";

    private static JsonObject Schema()
    {
        // Range 1–10 is stated in the prompt and enforced by Clamp in ParseResponse.
        static JsonObject Score() => new() { ["type"] = "integer" };
        static JsonObject List() => new() { ["type"] = "array", ["items"] = new JsonObject { ["type"] = "string" } };

        return new JsonObject
        {
            ["type"] = "object",
            ["properties"] = new JsonObject
            {
                ["score"] = Score(),
                ["subScores"] = new JsonObject
                {
                    ["type"] = "object",
                    ["properties"] = new JsonObject
                    {
                        ["structure"] = Score(),
                        ["relevance"] = Score(),
                        ["vocabulary"] = Score(),
                        ["fluency"] = Score(),
                        ["pace"] = Score(),
                    },
                    ["required"] = new JsonArray("structure", "relevance", "vocabulary", "fluency", "pace"),
                    ["additionalProperties"] = false,
                },
                ["summary"] = new JsonObject { ["type"] = "string", ["description"] = "1–2 предложения общего впечатления" },
                ["strengths"] = List(),
                ["improvements"] = List(),
                ["suggestions"] = List(),
                ["review"] = new JsonObject
                {
                    ["type"] = "string",
                    ["description"] = "Голосовое сообщение тренера по правилам раздела «Поле review»",
                },
            },
            ["required"] = new JsonArray("score", "subScores", "summary", "strengths", "improvements", "suggestions", "review"),
            ["additionalProperties"] = false,
        };
    }
}
