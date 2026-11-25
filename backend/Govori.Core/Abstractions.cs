namespace Govori.Core;

public interface IAudioStorage
{
    Task SaveAsync(string key, Stream content, CancellationToken ct);

    /// <summary>Returns a seekable stream so the API can serve HTTP range requests.</summary>
    Task<Stream> OpenReadAsync(string key, CancellationToken ct);

    Task DeleteAsync(string key, CancellationToken ct);
}

public interface ITranscriber
{
    Task<Transcription> TranscribeAsync(Stream audio, string fileName, CancellationToken ct);
}

/// <param name="Clarity">Share of words heard confidently (0–1), a rough proxy for diction; null when unknown.</param>
/// <param name="UnclearWords">Words heard least confidently.</param>
public record Transcription(string Text, double? Clarity = null, IReadOnlyList<string>? UnclearWords = null);

/// <summary>Scores an attempt and writes the coach's spoken review in a single AI call.</summary>
public interface ISpeechEvaluator
{
    Task<Evaluated> EvaluateAsync(EvaluationRequest request, CancellationToken ct);
}

/// <param name="Previous">The user's previous evaluated attempt, if any.</param>
/// <param name="RecentReviews">Recently spoken reviews, newest first, so the new one can avoid repeating them.</param>
public record EvaluationRequest(
    string Topic, string Transcript, SpeechMetrics Metrics, EvaluationResult? Previous, IReadOnlyList<string> RecentReviews);

/// <param name="Review">Text for the voice-over; null when the provider gave none (the template is used then).</param>
public record Evaluated(EvaluationResult Result, string? Review);

/// <summary>Turns text into speech (MP3). Used for the spoken AI review.</summary>
public interface ISpeechSynthesizer
{
    Task<byte[]> SynthesizeAsync(string text, CancellationToken ct);
}

/// <summary>Reads server-side texts (prompts, word lists) from the database.</summary>
public interface IContentProvider
{
    Task<string> GetAsync(string key, CancellationToken ct);
}

public static class SettingKeys
{
    // Renamed with the rubric: the old prompt asked for a different JSON shape, so it must not be reused.
    // Versioned keys: defaults are seeded only when a key is missing, so a new version is how changed
    // defaults reach an existing database. v2 of the prompt adds synonyms and practical "how to improve" tips.
    public const string EvaluationSystemPrompt = "evaluation.rubricPrompt.v4";
    public const string TranscriptionPrompt = "transcription.prompt";
    public const string FillersSingle = "fillers.single.v2";   // one word per line
    public const string FillersPhrases = "fillers.phrases.v2"; // one phrase per line
    public const string EvaluationFailed = "errors.evaluationFailed";
    public const string NoSpeech = "errors.noSpeech";
    // v2: the review is written for the ear (no abbreviations, numbers in words) and voiced by gpt-audio,
    // which takes the instructions as a system prompt and must read the text word for word.
    public const string ReviewSystemPrompt = "review.systemPrompt.v2";
    public const string ReviewVoiceInstructions = "review.voiceInstructions.v2";
}

/// <param name="Clarity">See <see cref="Transcription.Clarity"/>. Shown to the user, not scored.</param>
public record SpeechMetrics(
    int DurationSec, int WordCount, int WordsPerMinute, Dictionary<string, int> FillerWords,
    double? Clarity = null, List<string>? UnclearWords = null, VocabularyStats? Vocabulary = null)
{
    public int FillerTotal => FillerWords.Values.Sum();
}

/// <summary>Legacy 1–10 sub-scores; only on evaluations made before the rubric.</summary>
public record SubScores(int Structure, int Relevance, int Vocabulary, int Fluency, int Pace);

/// <param name="Points">0, 1 or 2.</param>
/// <param name="Evidence">Why: a short analysis with quotes from the speech.</param>
/// <param name="ToMax">How to improve: a practical technique that would have earned 2 points; empty at 2.</param>
/// <param name="Good">What worked, with a quote; empty when nothing did or on older evaluations.</param>
/// <param name="Advice">The technique to fix it; null at 2 points and on older evaluations.</param>
public record Criterion(int Points, string Evidence, string ToMax, string Good = "", TechniqueAdvice? Advice = null);

/// <summary>
/// A technique from the catalog applied to this speech. Name and Formula come from the catalog, not the model;
/// both are empty when the model named a technique the catalog doesn't have for this criterion.
/// </summary>
/// <param name="Before">A quote from the speech the technique fixes; empty when there is none to quote.</param>
/// <param name="After">The same place rewritten with the technique, using only what the speaker said.</param>
/// <param name="Hypothetical">After adds an example the speaker didn't give; the UI marks it as made up.</param>
/// <param name="NextStep">One action for the next speech.</param>
public record TechniqueAdvice(
    string TechniqueId, string Name, string Formula, string Before, string After, bool Hypothetical, string NextStep);

/// <summary>The one 30-second exercise, aimed at the weakest criterion and its technique.</summary>
public record Practice(string TechniqueId, string Name, string Criterion, string Text)
{
    /// <summary>
    /// The weakest criterion (fewest points; ties go to the earlier one, as structure comes before delivery)
    /// with an advice technique; null when every criterion is at full marks.
    /// </summary>
    public static (string Key, Technique Technique)? Target(Rubric rubric) =>
        rubric.All()
            .Where(c => c.Criterion.Points < 2 && Techniques.ForCriterion(c.Criterion.Advice?.TechniqueId, c.Key) is not null)
            .OrderBy(c => c.Criterion.Points)
            .Select(c => (c.Key, Techniques.Find(c.Criterion.Advice!.TechniqueId)!))
            .Cast<(string, Technique)?>()
            .FirstOrDefault();
}

/// <summary>
/// The scoring rubric: five criteria worth 0–2 each, adding up to the 0–10 score. Built on the PREP formula
/// (Point, Reason, Example, Point) and the Toastmasters Table Topics evaluation. Delivery is measured, not judged.
/// </summary>
public record Rubric(Criterion Thought, Criterion Support, Criterion Conclusion, Criterion Coherence, Criterion Delivery)
{
    public int Total => Thought.Points + Support.Points + Conclusion.Points + Coherence.Points + Delivery.Points;

    public IEnumerable<(string Key, Criterion Criterion)> All() =>
    [
        ("thought", Thought), ("support", Support), ("conclusion", Conclusion),
        ("coherence", Coherence), ("delivery", Delivery),
    ];
}

/// <summary>The speech laid out on the PREP steps; each is a short quote, or null when the step is missing.</summary>
public record Skeleton(string? Point, string? Reason, string? Example, string? Conclusion);

/// <summary>
/// Feedback follows the Toastmasters pattern: one thing that worked (Strengths), one fix (Improvements),
/// one exercise (Suggestions). Rubric and Skeleton are null on evaluations made before the rubric.
/// Drill is a vocabulary exercise, given only when the speech was monotonous.
/// </summary>
public record EvaluationResult(
    int Score,
    SubScores? SubScores,
    string Summary,
    List<string> Strengths,
    List<string> Improvements,
    List<string> Suggestions,
    Rubric? Rubric = null,
    Skeleton? Skeleton = null,
    string? Drill = null,
    List<WordSynonyms>? Synonyms = null,
    Practice? Practice = null,
    string? DrillTechnique = null);

/// <summary>Replacements for a word the speaker repeated too often.</summary>
public record WordSynonyms(string Word, List<string> Options);

/// <summary>Scores delivery from measured numbers, so it can't be inflated by the model.</summary>
public static class Delivery
{
    public const int MinWpm = 110, MaxWpm = 160, MinSeconds = 45;
    public const double MaxFillersPerMinute = 2;

    public static Criterion Score(SpeechMetrics m)
    {
        var fillersPerMin = m.FillerTotal / (Math.Max(m.DurationSec, 1) / 60.0);
        var fixes = new List<string>();
        // The technique for the main problem: fillers first, as they are the most audible, then pace.
        string? technique = null;
        if (fillersPerMin > MaxFillersPerMinute)
        {
            var top = m.FillerWords.OrderByDescending(kv => kv.Value).Select(kv => kv.Key).FirstOrDefault() ?? "ну";
            fixes.Add($"Паразиты · Тихая пауза: почувствовали «{top}» на языке — замолчите на секунду. Пауза звучит увереннее любого слова.");
            technique = "silent-pause";
        }
        if (m.WordsPerMinute < MinWpm)
        {
            fixes.Add("Темп · Одна мысль — одно предложение: говорите фразами по 5–7 слов и ставьте точку — так речь сама ускоряется.");
            technique ??= "one-thought-one-sentence";
        }
        else if (m.WordsPerMinute > MaxWpm)
        {
            fixes.Add("Темп · Смысловые блоки: после каждой законченной мысли — пауза на вдох, слушателю нужно время её услышать.");
            technique ??= "chunking";
        }
        if (m.DurationSec < MinSeconds)
            fixes.Add($"Длительность: говорите не меньше {MinSeconds} секунд — если мысль закончилась, добавьте ещё один пример из жизни.");

        var points = fixes.Count switch { 0 => 2, 1 => 1, _ => 0 };
        var evidence = string.Create(System.Globalization.CultureInfo.InvariantCulture,
            $"{m.WordsPerMinute} сл/мин · {fillersPerMin:0.#} паразит./мин · {m.DurationSec} с");
        var toMax = string.Join("\n", fixes);
        var advice = points < 2 && Techniques.Find(technique) is { } t
            ? new TechniqueAdvice(t.Id, t.Name, t.Formula, "", "", false, t.Drill)
            : null;
        return new Criterion(points, evidence, toMax, "", advice);
    }
}

public record StoredEvaluation(EvaluationResult Result, SpeechMetrics Metrics);

/// <summary>Fallback review used when no AI writer is available.</summary>
public static class ReviewScript
{
    public static string Build(EvaluationResult r, EvaluationResult? previous = null)
    {
        var verdict = ScoreTier(r.Score);
        var opening = previous is null ? $"{verdict}, думаю, {r.Score} из 10."
            : r.Score > previous.Score ? $"Уже лучше, чем в прошлый раз! {r.Score} из 10."
            : r.Score < previous.Score ? $"В этот раз чуть слабее, {r.Score} из 10, но это нормально."
            : $"Стабильно: снова {r.Score} из 10.";
        var parts = new List<string> { opening, r.Summary };
        if (r.Strengths.Count > 0) parts.Add("Особенно понравилось: " + Lower(r.Strengths[0]));
        if (r.Improvements.Count > 0) parts.Add("В следующий раз обрати внимание: " + Lower(r.Improvements[0]));
        return string.Join("\n\n", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
    }

    /// <summary>How a score sounds in words; shared with the AI prompt so both use one scale.</summary>
    public static string ScoreTier(int score) => score switch
    {
        <= 2 => "Пока тяжеловато",
        <= 4 => "Есть над чем поработать",
        <= 6 => "Неплохо",
        <= 8 => "Хорошо",
        _ => "Отлично",
    };

    private static string Lower(string s)
    {
        s = s.Trim().TrimEnd('.', ';');
        return s.Length == 0 ? s : char.ToLowerInvariant(s[0]) + s[1..] + ".";
    }
}
