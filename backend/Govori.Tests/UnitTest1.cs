using Govori.Core;
using Govori.Infrastructure;

namespace Govori.Tests;

public class SpeechAnalyzerTests
{
    private static SpeechMetrics Analyze(string text, int durationSec) =>
        SpeechAnalyzer.Analyze(text, durationSec,
            SettingDefaults.Lines(SettingDefaults.All[SettingKeys.FillersSingle]).ToHashSet(),
            SettingDefaults.Lines(SettingDefaults.All[SettingKeys.FillersPhrases]));

    [Fact]
    public void Counts_single_and_phrase_fillers()
    {
        var m = Analyze("Ну, я как бы думаю, что, э-э, это ну очень важно. Вот.", 60);

        Assert.Equal(2, m.FillerWords["ну"]);
        Assert.Equal(1, m.FillerWords["как бы"]);
        Assert.Equal(1, m.FillerWords["э-э"]);
        Assert.Equal(1, m.FillerWords["вот"]);
    }

    [Fact]
    public void Computes_words_per_minute()
    {
        var m = Analyze(string.Join(' ', Enumerable.Repeat("слово", 60)), 30);

        Assert.Equal(60, m.WordCount);
        Assert.Equal(120, m.WordsPerMinute);
    }

    [Theory]
    [InlineData("")]
    [InlineData("Ну, вот.")]
    [InlineData("Ну, э-э, как бы, вот. Расшифруй дословно, сохраняя слова-паразиты.")]
    public void Detects_no_speech_and_prompt_echo(string transcript)
    {
        Assert.True(SpeechAnalyzer.IsNoSpeech(transcript, "Ну, э-э, как бы, вот. Расшифруй дословно, сохраняя слова-паразиты."));
    }

    [Fact]
    public void Real_speech_is_not_flagged()
    {
        Assert.False(SpeechAnalyzer.IsNoSpeech("Самый важный урок, который я получил в детстве, это умение доводить дело до конца.",
            SettingDefaults.All[SettingKeys.TranscriptionPrompt]));
    }

    [Fact]
    public void Empty_transcript_is_safe()
    {
        var m = Analyze("", 0);
        Assert.Equal(0, m.WordCount);
        Assert.Empty(m.FillerWords);
    }
}

public class ClaudeEvaluatorTests
{
    [Fact]
    public void Parses_structured_output_and_clamps_scores()
    {
        const string json = """
            {"score":12,"subScores":{"structure":0,"relevance":8,"vocabulary":7,"fluency":6,"pace":5},
             "summary":"Хорошо","strengths":["a"],"improvements":["b"],"suggestions":["c"]}
            """;
        var response = new System.Text.Json.Nodes.JsonObject
        {
            ["stop_reason"] = "end_turn",
            ["content"] = new System.Text.Json.Nodes.JsonArray(
                new System.Text.Json.Nodes.JsonObject { ["type"] = "thinking", ["thinking"] = "" },
                new System.Text.Json.Nodes.JsonObject { ["type"] = "text", ["text"] = json }),
        }.ToJsonString();

        var (r, review) = ClaudeEvaluator.ParseResponse(response);

        Assert.Equal(10, r.Score);
        Assert.Equal(1, r.SubScores.Structure);
        Assert.Equal("Хорошо", r.Summary);
        Assert.Null(review);
    }

    [Fact]
    public void Parses_and_trims_the_review()
    {
        const string json = """
            {"score":7,"subScores":{"structure":7,"relevance":7,"vocabulary":7,"fluency":7,"pace":7},
             "summary":"s","strengths":[],"improvements":[],"suggestions":[],"review":"  Привет! Неплохо, 7 из 10. "}
            """;
        var response = new System.Text.Json.Nodes.JsonObject
        {
            ["stop_reason"] = "end_turn",
            ["content"] = new System.Text.Json.Nodes.JsonArray(new System.Text.Json.Nodes.JsonObject { ["type"] = "text", ["text"] = json }),
        }.ToJsonString();

        Assert.Equal("Привет! Неплохо, 7 из 10.", ClaudeEvaluator.ParseResponse(response).Review);
    }

    [Theory]
    [InlineData("""{"stop_reason":"refusal","content":[]}""")]
    [InlineData("""{"stop_reason":"max_tokens","content":[{"type":"text","text":"{"}]}""")]
    [InlineData("""{"stop_reason":"end_turn","content":[]}""")]
    public void Rejects_unfinished_or_empty_responses(string json) =>
        Assert.Throws<InvalidOperationException>(() => ClaudeEvaluator.ParseResponse(json));
}

public class ReviewScriptTests
{
    private static EvaluationResult Eval(int score) => new(score, new SubScores(score, score, score, score, score),
        "Тема раскрыта.", ["Чёткая структура."], ["Меньше пауз;"], []);

    [Theory]
    [InlineData(6, null, "Неплохо, думаю, 6 из 10.")]
    [InlineData(7, 5, "Уже лучше")]
    [InlineData(4, 6, "В этот раз чуть слабее")]
    public void Opening_reflects_score_and_trend(int score, int? previous, string expected)
    {
        var script = ReviewScript.Build(Eval(score), previous is null ? null : Eval(previous.Value));
        Assert.StartsWith(expected, script, StringComparison.Ordinal);
    }

    [Fact]
    public void Prompt_message_includes_trend_and_recent_reviews()
    {
        var msg = ClaudeEvaluator.BuildMessage(new EvaluationRequest("Тема", "Текст", new SpeechMetrics(60, 120, 120, []),
            Eval(6), ["Привет! Было здорово."]));

        Assert.Contains("Прошлое выступление: 6/10 (неплохо)", msg, StringComparison.Ordinal);
        Assert.Contains("Привет! Было здорово.", msg, StringComparison.Ordinal);
    }

    [Fact]
    public void Prompt_message_marks_the_first_attempt()
    {
        var msg = ClaudeEvaluator.BuildMessage(new EvaluationRequest("Тема", "Текст", new SpeechMetrics(60, 120, 120, []), null, []));
        Assert.Contains("это первое", msg, StringComparison.Ordinal);
        Assert.Contains("Расшифровка:\nТекст", msg.ReplaceLineEndings("\n"), StringComparison.Ordinal);
        Assert.DoesNotContain("недавние", msg, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(1, "Пока тяжеловато")]
    [InlineData(4, "Есть над чем поработать")]
    [InlineData(5, "Неплохо")]
    [InlineData(8, "Хорошо")]
    [InlineData(10, "Отлично")]
    public void Score_tiers(int score, string expected) => Assert.Equal(expected, ReviewScript.ScoreTier(score));

    [Fact]
    public void Same_score_is_called_stable() =>
        Assert.StartsWith("Стабильно: снова 6 из 10.", ReviewScript.Build(Eval(6), Eval(6)), StringComparison.Ordinal);
}

public class KeyedLockTests
{
    [Fact]
    public async Task Same_key_waits_and_entries_are_dropped_after_release()
    {
        var locks = new KeyedLock<int>();
        var first = await locks.AcquireAsync(1, CancellationToken.None);
        var second = locks.AcquireAsync(1, CancellationToken.None);
        var other = await locks.AcquireAsync(2, CancellationToken.None);

        Assert.False(second.IsCompleted);
        Assert.Equal(2, locks.Count);

        first.Dispose();
        (await second.WaitAsync(TimeSpan.FromSeconds(5))).Dispose();
        other.Dispose();
        Assert.Equal(0, locks.Count);
    }

    [Fact]
    public async Task Cancelled_waiter_leaves_no_entry()
    {
        var locks = new KeyedLock<int>();
        var held = await locks.AcquireAsync(1, CancellationToken.None);
        using var cts = new CancellationTokenSource();
        var waiting = locks.AcquireAsync(1, cts.Token);
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => waiting);
        held.Dispose();
        Assert.Equal(0, locks.Count);
    }
}
