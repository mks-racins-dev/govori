using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Govori.Core;

namespace Govori.Infrastructure;

public class ClaudeEvaluator(HttpClient http, IContentProvider content, string apiKey, string model) : ISpeechEvaluator
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<EvaluationResult> EvaluateAsync(string topic, string transcript, SpeechMetrics metrics, CancellationToken ct)
    {
        var fillers = metrics.FillerWords.Count == 0
            ? "нет"
            : string.Join(", ", metrics.FillerWords.Select(kv => $"«{kv.Key}» ×{kv.Value}"));

        var userMessage =
            $"Тема: {topic}\n" +
            $"Длительность: {metrics.DurationSec} с\n" +
            $"Слов: {metrics.WordCount}, темп: {metrics.WordsPerMinute} слов/мин\n" +
            $"Слова-паразиты: {fillers}\n\n" +
            $"Расшифровка:\n{(string.IsNullOrWhiteSpace(transcript) ? "(пусто)" : transcript)}";

        var body = new JsonObject
        {
            ["model"] = model,
            ["max_tokens"] = 16000,
            ["system"] = await content.GetAsync(SettingKeys.EvaluationSystemPrompt, ct),
            // Structured outputs: the reply is a text block whose JSON is guaranteed to match the schema.
            ["output_config"] = new JsonObject
            {
                ["format"] = new JsonObject { ["type"] = "json_schema", ["schema"] = Schema() },
            },
            ["messages"] = new JsonArray(new JsonObject { ["role"] = "user", ["content"] = userMessage }),
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

    public static EvaluationResult ParseResponse(string responseJson)
    {
        var root = JsonNode.Parse(responseJson)!;
        var stopReason = root["stop_reason"]?.GetValue<string>();
        if (stopReason is "refusal" or "max_tokens")
            throw new InvalidOperationException($"Claude stopped with '{stopReason}'.");

        var text = root["content"]!.AsArray()
            .FirstOrDefault(c => c?["type"]?.GetValue<string>() == "text")?["text"]?.GetValue<string>()
            ?? throw new InvalidOperationException("Claude response had no text block.");

        var result = JsonSerializer.Deserialize<EvaluationResult>(text, Json)
            ?? throw new InvalidOperationException("Empty evaluation.");

        if (result.SubScores is null || result.Strengths is null || result.Improvements is null || result.Suggestions is null)
            throw new InvalidOperationException("Evaluation is missing required fields.");

        static int Clamp(int v) => Math.Clamp(v, 1, 10);
        var s = result.SubScores;
        return result with
        {
            Score = Clamp(result.Score),
            SubScores = new SubScores(Clamp(s.Structure), Clamp(s.Relevance), Clamp(s.Vocabulary), Clamp(s.Fluency), Clamp(s.Pace)),
        };
    }

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
                        ["structure"] = Score(), ["relevance"] = Score(), ["vocabulary"] = Score(),
                        ["fluency"] = Score(), ["pace"] = Score(),
                    },
                    ["required"] = new JsonArray("structure", "relevance", "vocabulary", "fluency", "pace"),
                    ["additionalProperties"] = false,
                },
                ["summary"] = new JsonObject { ["type"] = "string", ["description"] = "1–2 предложения общего впечатления" },
                ["strengths"] = List(),
                ["improvements"] = List(),
                ["suggestions"] = List(),
            },
            ["required"] = new JsonArray("score", "subScores", "summary", "strengths", "improvements", "suggestions"),
            ["additionalProperties"] = false,
        };
    }
}
