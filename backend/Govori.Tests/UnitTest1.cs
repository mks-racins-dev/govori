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
    private static readonly SpeechMetrics GoodDelivery = new(60, 130, 130, []);

    private static string Wrap(string json) => new System.Text.Json.Nodes.JsonObject
    {
        ["stop_reason"] = "end_turn",
        ["content"] = new System.Text.Json.Nodes.JsonArray(
            new System.Text.Json.Nodes.JsonObject { ["type"] = "thinking", ["thinking"] = "" },
            new System.Text.Json.Nodes.JsonObject { ["type"] = "text", ["text"] = json }),
    }.ToJsonString();

    private const string Reply = """
        {"thought":{"points":5,"evidence":"«мысль»","toMax":"лишнее"},
         "support":{"points":1,"evidence":"общий пример","toMax":"свой случай"},
         "conclusion":{"points":-1,"evidence":"обрыв","toMax":"итог"},
         "coherence":{"points":2,"evidence":"по теме","toMax":""},
         "skeleton":{"point":"мысль","reason":null,"example":"  ","conclusion":null},
         "summary":"Хорошо","strength":"a","fix":"b","exercise":"c","drill":" Подберите 5 замен слову «очень». ",
         "review":"  Привет! Неплохо, 6 из 10. "}
        """;

    [Fact]
    public void Score_is_the_sum_of_clamped_criteria_plus_measured_delivery()
    {
        var (r, review) = ClaudeEvaluator.ParseResponse(Wrap(Reply), GoodDelivery);

        Assert.NotNull(r.Rubric);
        Assert.Equal(2, r.Rubric.Thought.Points);
        Assert.Equal("", r.Rubric.Thought.ToMax); // full marks need no advice
        Assert.Equal(0, r.Rubric.Conclusion.Points);
        Assert.Equal(2, r.Rubric.Delivery.Points);
        Assert.Equal(2 + 1 + 0 + 2 + 2, r.Score);
        Assert.Equal(["a"], r.Strengths);
        Assert.Equal("Привет! Неплохо, 6 из 10.", review);
    }

    [Fact]
    public void Drill_is_kept_only_when_the_app_found_the_vocabulary_monotonous()
    {
        var low = GoodDelivery with { Vocabulary = new VocabularyStats(0.5, [new("очень", 5)], IsLow: true) };
        var fine = GoodDelivery with { Vocabulary = new VocabularyStats(0.8, [], IsLow: false) };

        Assert.Equal("Подберите 5 замен слову «очень».", ClaudeEvaluator.ParseResponse(Wrap(Reply), low).Result.Drill);
        Assert.Null(ClaudeEvaluator.ParseResponse(Wrap(Reply), fine).Result.Drill);
        Assert.Null(ClaudeEvaluator.ParseResponse(Wrap(Reply), GoodDelivery).Result.Drill);
    }

    [Fact]
    public void Synonyms_are_kept_only_for_counted_repeats()
    {
        var json = Reply.Replace("\"review\":", "\"synonyms\":[{\"word\":\"Очень\",\"options\":[\"крайне\",\" весьма \",\"\",\"крайне\"]},{\"word\":\"лишнее\",\"options\":[\"x\"]}],\"review\":");
        var m = GoodDelivery with { Vocabulary = new VocabularyStats(0.5, [new("очень", 5)], IsLow: true) };

        var s = Assert.Single(ClaudeEvaluator.ParseResponse(Wrap(json), m).Result.Synonyms!);
        Assert.Equal("очень", s.Word);
        Assert.Equal(["крайне", "весьма"], s.Options);
        Assert.Null(ClaudeEvaluator.ParseResponse(Wrap(json), GoodDelivery).Result.Synonyms);
    }

    [Fact]
    public void Blank_skeleton_steps_become_null()
    {
        var sk = ClaudeEvaluator.ParseResponse(Wrap(Reply), GoodDelivery).Result.Skeleton!;
        Assert.Equal("мысль", sk.Point);
        Assert.Null(sk.Example);
        Assert.Null(sk.Reason);
    }

    [Theory]
    [InlineData("""{"stop_reason":"refusal","content":[]}""")]
    [InlineData("""{"stop_reason":"max_tokens","content":[{"type":"text","text":"{"}]}""")]
    [InlineData("""{"stop_reason":"end_turn","content":[]}""")]
    public void Rejects_unfinished_or_empty_responses(string json) =>
        Assert.Throws<InvalidOperationException>(() => ClaudeEvaluator.ParseResponse(json, GoodDelivery));
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
        Assert.Contains("Подача (посчитана приложением): 2/2", msg, StringComparison.Ordinal);
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

public class DeliveryTests
{
    [Theory]
    [InlineData(60, 130, 1, 2)]  // all within norms
    [InlineData(60, 90, 1, 1)]   // too slow
    [InlineData(60, 90, 5, 0)]   // too slow and many fillers
    [InlineData(30, 130, 0, 1)]  // too short
    public void Points_drop_with_each_missed_norm(int seconds, int wpm, int fillers, int expected)
    {
        var m = new SpeechMetrics(seconds, wpm * seconds / 60, wpm, fillers == 0 ? [] : new() { ["ну"] = fillers });
        var c = Delivery.Score(m);
        Assert.Equal(expected, c.Points);
        Assert.Equal(expected == 2, c.ToMax == "");
    }
}

public class ClarityTests
{
    [Fact]
    public void Joins_tokens_into_words_and_flags_the_least_confident()
    {
        var tokens = new (string, double)[]
        {
            (" Пон", -0.01), ("едельник", -0.02), (" —", -0.01), (" луч", -2.5), ("ший", -0.1), (" день", -0.05), (".", 0),
        };
        var (clarity, unclear) = Clarity.FromTokens(tokens);
        Assert.Equal(0.67, clarity);
        Assert.Equal(["лучший"], unclear);
    }

    [Fact]
    public void No_words_means_unknown_clarity() => Assert.Null(Clarity.FromTokens([]).Clarity);
}

public class VocabularyTests
{
    private static readonly HashSet<string> Fillers = ["типа", "короче"];

    [Fact]
    public void Repeated_words_make_speech_monotonous_and_topic_words_are_ignored()
    {
        const string text =
            "Понедельник очень хороший день. Понедельника все ждут, понедельник очень важный. Это очень хороший " +
            "старт недели, очень хороший повод начать новое дело, очень хороший шанс. Потому что хороший план " +
            "помогает всей неделе, и это очень хорошо для всех людей вокруг нас, правда хорошо.";
        var v = Vocabulary.Analyze(text, "Понедельник — лучший день недели", Fillers)!;

        Assert.True(v.IsLow);
        Assert.Equal(new WordRepeat("хороший", 7), v.Repeats[0]); // forms merged: хороший ×5 + хорошо ×2
        Assert.Equal(new WordRepeat("очень", 6), v.Repeats[1]);
        Assert.DoesNotContain(v.Repeats, r => r.Word.StartsWith("понед", StringComparison.Ordinal));
    }

    [Fact]
    public void Varied_speech_is_not_flagged()
    {
        const string text =
            "Скука полезна, потому что мозгу нужно пустое время. Сорок минут я смотрел в стену и придумал, " +
            "как переделать отчёт. Начальник потом хвалил результат. Когда мы заполняем каждую свободную секунду " +
            "лентой, мы лишаем себя этого времени. Поэтому совет простой: станет скучно — не хватайтесь за телефон.";
        var v = Vocabulary.Analyze(text, "Скука полезна", Fillers)!;

        Assert.False(v.IsLow);
        Assert.Empty(v.Repeats);
    }

    [Fact]
    public void Too_little_speech_is_not_judged() => Assert.Null(Vocabulary.Analyze("Ну вот такой короткий ответ получился.", "Тема", Fillers));
}

public class VoicedReviewCheckTests
{
    private const string Text = "Так, слушай... Начало хорошее. В целом — шесть из десяти, и это крепкая база.";

    [Fact]
    public void Word_for_word_reading_passes()
    {
        Assert.Equal(1, OpenAiSpeechSynthesizer.Similarity(Text, "Так, слушай. Начало хорошее! В целом шесть из десяти, и это крепкая база."));
        Assert.True(OpenAiSpeechSynthesizer.SameNumbers(Text, "так слушай начало хорошее в целом шесть из десяти и это крепкая база"));
    }

    [Fact]
    public void Added_or_dropped_words_lower_the_similarity()
    {
        var s = OpenAiSpeechSynthesizer.Similarity(Text, "Так, слушай внимательно, дружище. В общем, крепкая база.");
        Assert.True(s < OpenAiSpeechSynthesizer.MinSimilarity);
    }

    [Fact]
    public void A_changed_score_is_caught()
    {
        Assert.False(OpenAiSpeechSynthesizer.SameNumbers(Text, "Так, слушай... Начало хорошее. В целом — семь из десяти, и это крепкая база."));
    }
}

public class TechniqueTests
{
    private static readonly SpeechMetrics GoodDelivery = new(60, 130, 130, []);

    private static string Wrap(string json) => new System.Text.Json.Nodes.JsonObject
    {
        ["stop_reason"] = "end_turn",
        ["content"] = new System.Text.Json.Nodes.JsonArray(
            new System.Text.Json.Nodes.JsonObject { ["type"] = "text", ["text"] = json }),
    }.ToJsonString();

    private static string Reply(string thought, string support, string conclusion, string coherence,
        string exerciseTechnique = "ring", string exercise = "Придумайте последнюю фразу.") => $$"""
        {"thought":{{thought}},"support":{{support}},"conclusion":{{conclusion}},"coherence":{{coherence}},
         "skeleton":{"point":null,"reason":null,"example":null,"conclusion":null},
         "summary":"s","strength":"a","fix":"b","exercise":"{{exercise}}","exerciseTechnique":"{{exerciseTechnique}}",
         "drill":"","drillTechnique":"","synonyms":[],"review":"r"}
        """;

    private static string C(int points, string technique = "", string after = "", string next = "") =>
        $$"""{"points":{{points}},"good":"g","evidence":"e","technique":"{{technique}}","before":"до","after":"{{after}}","hypothetical":false,"nextStep":"{{next}}"}""";

    private static readonly string Full = C(2);

    private static readonly System.Text.Json.JsonSerializerOptions WebJson =
        new(System.Text.Json.JsonSerializerDefaults.Web);

    [Fact]
    public void Catalog_ids_are_unique_and_every_criterion_has_techniques()
    {
        Assert.Equal(Techniques.All.Count, Techniques.All.Select(t => t.Id).Distinct().Count());
        foreach (var key in new[] { "thought", "support", "conclusion", "coherence", "delivery", Techniques.Vocabulary })
            Assert.Contains(Techniques.All, t => t.Criterion == key);
        Assert.All(Techniques.All, t => Assert.False(string.IsNullOrWhiteSpace(t.Formula + t.Drill + t.Name)));
    }

    [Fact]
    public void A_catalog_technique_gets_its_name_and_formula_from_the_app()
    {
        var (r, _) = ClaudeEvaluator.ParseResponse(Wrap(Reply(Full, Full, C(0, "ring", "«Поэтому…»", "Сделайте так."), Full)), GoodDelivery);
        var a = r.Rubric!.Conclusion.Advice!;
        Assert.Equal("ring", a.TechniqueId);
        Assert.Equal(Techniques.Find("ring")!.Name, a.Name);
        Assert.Equal(Techniques.Find("ring")!.Formula, a.Formula);
        Assert.Equal("до", a.Before);
        Assert.Equal("Сделайте так.", a.NextStep);
    }

    [Fact]
    public void Full_marks_get_no_advice_even_if_the_model_sent_one()
    {
        var (r, _) = ClaudeEvaluator.ParseResponse(Wrap(Reply(C(2, "prep", "x", "y"), Full, Full, Full)), GoodDelivery);
        Assert.Null(r.Rubric!.Thought.Advice);
        Assert.Equal("", r.Rubric.Thought.ToMax);
    }

    [Theory]
    [InlineData("no-such-technique")]
    [InlineData("ring")] // exists, but belongs to "conclusion", not "thought"
    public void Unknown_or_foreign_technique_keeps_the_example_but_not_the_name(string id)
    {
        var (r, _) = ClaudeEvaluator.ParseResponse(Wrap(Reply(C(1, id, "после", "шаг"), Full, Full, Full)), GoodDelivery);
        var a = r.Rubric!.Thought.Advice!;
        Assert.Equal("", a.TechniqueId);
        Assert.Equal("", a.Name);
        Assert.Equal("после", a.After);
        Assert.Equal("шаг", r.Rubric.Thought.ToMax);
    }

    [Fact]
    public void A_technique_is_never_reused_across_criteria()
    {
        // The model put "abt" (coherence) on every criterion; only coherence may keep it.
        var abt = C(1, "abt", "a", "n");
        var (r, _) = ClaudeEvaluator.ParseResponse(Wrap(Reply(abt, abt, abt, abt)), GoodDelivery);
        var ids = r.Rubric!.All().Select(c => c.Criterion.Advice?.TechniqueId).Where(id => !string.IsNullOrEmpty(id)).ToList();
        Assert.Equal(ids.Distinct().Count(), ids.Count);
        Assert.Equal("abt", r.Rubric.Coherence.Advice!.TechniqueId);
    }

    [Fact]
    public void Practice_targets_the_weakest_criterion()
    {
        var (r, _) = ClaudeEvaluator.ParseResponse(
            Wrap(Reply(C(1, "prep", "a", "n"), Full, C(0, "ring", "a", "n"), Full, "ring", "Свой текст")), GoodDelivery);
        Assert.Equal("ring", r.Practice!.TechniqueId);
        Assert.Equal("conclusion", r.Practice.Criterion);
        Assert.Equal("Свой текст", r.Practice.Text);
    }

    [Fact]
    public void Practice_for_the_wrong_technique_is_replaced_by_the_catalog_drill()
    {
        var (r, _) = ClaudeEvaluator.ParseResponse(
            Wrap(Reply(C(1, "prep", "a", "n"), Full, C(0, "ring", "a", "n"), Full, "prep", "Про мысль")), GoodDelivery);
        Assert.Equal("ring", r.Practice!.TechniqueId);
        Assert.Equal(Techniques.Find("ring")!.Drill, r.Practice.Text);
    }

    [Fact]
    public void Weak_delivery_gets_a_delivery_technique_and_can_be_the_practice_target()
    {
        var fillers = new SpeechMetrics(60, 90, 90, new() { ["ну"] = 6 });
        var (r, _) = ClaudeEvaluator.ParseResponse(Wrap(Reply(Full, Full, Full, Full, "", "")), fillers);
        Assert.Equal(0, r.Rubric!.Delivery.Points);
        Assert.Equal("silent-pause", r.Rubric.Delivery.Advice!.TechniqueId);
        Assert.Equal("silent-pause", r.Practice!.TechniqueId);
    }

    [Fact]
    public void Incomplete_reply_is_rejected()
    {
        var broken = """{"thought":{"points":1,"evidence":"e"},"summary":"s"}""";
        Assert.Throws<InvalidOperationException>(() => ClaudeEvaluator.ParseResponse(Wrap(broken), GoodDelivery));
    }

    [Fact]
    public void Stored_evaluations_from_before_the_catalog_still_load()
    {
        var old = """
            {"result":{"score":6,"subScores":null,"summary":"s","strengths":[],"improvements":[],"suggestions":[],
             "rubric":{"thought":{"points":1,"evidence":"e","toMax":"совет"},"support":{"points":2,"evidence":"e","toMax":""},
             "conclusion":{"points":1,"evidence":"e","toMax":"кольцо"},"coherence":{"points":2,"evidence":"e","toMax":""},
             "delivery":{"points":0,"evidence":"e","toMax":"t"}}},
             "metrics":{"durationSec":60,"wordCount":100,"wordsPerMinute":100,"fillerWords":{}}}
            """;
        var s = System.Text.Json.JsonSerializer.Deserialize<StoredEvaluation>(old, WebJson)!;
        Assert.Null(s.Result.Rubric!.Thought.Advice);
        Assert.Equal("совет", s.Result.Rubric.Thought.ToMax);
        Assert.Null(s.Result.Practice);
    }
}
