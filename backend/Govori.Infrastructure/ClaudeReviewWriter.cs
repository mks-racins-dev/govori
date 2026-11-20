using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using Govori.Core;

namespace Govori.Infrastructure;

/// <summary>Asks Claude for a short, informal spoken review that varies from one attempt to the next.</summary>
public class ClaudeReviewWriter(HttpClient http, IContentProvider content, string apiKey, string model) : IReviewWriter
{
    public async Task<string> WriteAsync(ReviewContext context, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["model"] = model,
            ["max_tokens"] = 1024,
            ["system"] = await content.GetAsync(SettingKeys.ReviewSystemPrompt, ct),
            ["messages"] = new JsonArray(new JsonObject { ["role"] = "user", ["content"] = BuildMessage(context) }),
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        req.Headers.Add("x-api-key", apiKey);
        req.Headers.Add("anthropic-version", "2023-06-01");

        using var res = await http.SendAsync(req, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"Claude review request failed ({(int)res.StatusCode}): {text}");

        return ParseResponse(text);
    }

    public static string ParseResponse(string responseJson)
    {
        var root = JsonNode.Parse(responseJson)!;
        if (root["stop_reason"]?.GetValue<string>() is "refusal" or "max_tokens")
            throw new InvalidOperationException("Claude did not finish the review.");
        var review = string.Concat(root["content"]!.AsArray()
            .Where(c => c?["type"]?.GetValue<string>() == "text")
            .Select(c => c!["text"]!.GetValue<string>())).Trim();
        return review.Length > 0 ? review : throw new InvalidOperationException("Empty review.");
    }

    public static string BuildMessage(ReviewContext c)
    {
        var sb = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        sb.AppendLine(inv, $"Тема: {c.Topic}");
        sb.AppendLine(inv, $"Оценка сейчас: {c.Current.Score}/10 ({ReviewScript.ScoreTier(c.Current.Score).ToLowerInvariant()})");
        sb.AppendLine(inv, $"Подоценки: {SubScores(c.Current.SubScores)}");
        sb.AppendLine(inv, $"Темп: {c.Metrics.WordsPerMinute} слов/мин, слов-паразитов: {c.Metrics.FillerTotal}");
        sb.AppendLine(inv, $"Общее впечатление: {c.Current.Summary}");
        sb.AppendLine(inv, $"Что получилось: {string.Join("; ", c.Current.Strengths)}");
        sb.AppendLine(inv, $"Что улучшить: {string.Join("; ", c.Current.Improvements)}");
        sb.AppendLine(inv, $"Советы: {string.Join("; ", c.Current.Suggestions)}");
        sb.AppendLine();

        if (c.Previous is { } p)
        {
            var trend = c.Current.Score > p.Score ? "стало лучше" : c.Current.Score < p.Score ? "стало хуже" : "так же";
            sb.AppendLine(inv, $"Прошлое выступление: {p.Score}/10 ({trend})");
            sb.AppendLine(inv, $"Прошлые подоценки: {SubScores(p.SubScores)}");
            sb.AppendLine(inv, $"В прошлый раз советовали улучшить: {string.Join("; ", p.Improvements)}");
        }
        else
        {
            sb.AppendLine("Прошлого выступления нет — это первое.");
        }

        if (c.RecentReviews.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("Твои недавние голосовые сообщения (не повторяй их фразы и структуру):");
            foreach (var r in c.RecentReviews) sb.AppendLine(inv, $"---\n{r}");
        }
        return sb.ToString();
    }

    private static string SubScores(SubScores s) =>
        $"структура {s.Structure}, по теме {s.Relevance}, словарь {s.Vocabulary}, плавность {s.Fluency}, темп {s.Pace}";
}

/// <summary>Used when no Anthropic key is configured.</summary>
public class TemplateReviewWriter : IReviewWriter
{
    public Task<string> WriteAsync(ReviewContext context, CancellationToken ct) =>
        Task.FromResult(ReviewScript.Build(context.Current, context.Previous));
}
