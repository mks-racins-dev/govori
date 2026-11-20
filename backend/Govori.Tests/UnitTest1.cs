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

        var r = ClaudeEvaluator.ParseResponse(response);

        Assert.Equal(10, r.Score);
        Assert.Equal(1, r.SubScores.Structure);
        Assert.Equal("Хорошо", r.Summary);
    }

    [Fact]
    public void Throws_on_refusal()
    {
        Assert.Throws<InvalidOperationException>(() =>
            ClaudeEvaluator.ParseResponse("""{"stop_reason":"refusal","content":[]}"""));
    }
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
        var msg = ClaudeReviewWriter.BuildMessage(new ReviewContext("Тема", Eval(8), new SpeechMetrics(60, 120, 120, []),
            Eval(6), ["Привет! Было здорово."]));

        Assert.Contains("Прошлое выступление: 6/10 (стало лучше)", msg, StringComparison.Ordinal);
        Assert.Contains("Привет! Было здорово.", msg, StringComparison.Ordinal);
    }

    [Fact]
    public void Prompt_message_marks_the_first_attempt()
    {
        var msg = ClaudeReviewWriter.BuildMessage(new ReviewContext("Тема", Eval(5), new SpeechMetrics(60, 120, 120, []), null, []));
        Assert.Contains("это первое", msg, StringComparison.Ordinal);
        Assert.Contains("5/10 (неплохо)", msg, StringComparison.Ordinal);
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

    [Fact]
    public void Writer_response_text_blocks_are_joined_and_trimmed() =>
        Assert.Equal("Привет! Неплохо, 6 из 10.", ClaudeReviewWriter.ParseResponse(
            """{"stop_reason":"end_turn","content":[{"type":"text","text":" Привет! "},{"type":"text","text":"Неплохо, 6 из 10."}]}"""));

    [Theory]
    [InlineData("""{"stop_reason":"refusal","content":[]}""")]
    [InlineData("""{"stop_reason":"max_tokens","content":[{"type":"text","text":"Обор"}]}""")]
    [InlineData("""{"stop_reason":"end_turn","content":[]}""")]
    public void Writer_rejects_unfinished_or_empty_responses(string json) =>
        Assert.Throws<InvalidOperationException>(() => ClaudeReviewWriter.ParseResponse(json));
}
