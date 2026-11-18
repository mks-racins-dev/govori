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

    [Fact]
    public void Deliberate_failing_test_for_ci_validation()
    {
        // This test deliberately fails to validate that CI blocks broken code
            Assert.True(false, "CI should block this PR");
    }
}
