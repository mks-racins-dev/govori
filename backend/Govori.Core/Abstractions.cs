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
    public const string EvaluationSystemPrompt = "evaluation.rubricPrompt";
    public const string TranscriptionPrompt = "transcription.prompt";
    public const string FillersSingle = "fillers.single";   // one word per line
    public const string FillersPhrases = "fillers.phrases"; // one phrase per line
    public const string EvaluationFailed = "errors.evaluationFailed";
    public const string NoSpeech = "errors.noSpeech";
    public const string ReviewSystemPrompt = "review.systemPrompt";
    public const string ReviewVoiceInstructions = "review.voiceInstructions";
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
/// <param name="Evidence">Why: a short quote or fact from the speech.</param>
/// <param name="ToMax">What would have earned 2 points; empty when it already has 2.</param>
public record Criterion(int Points, string Evidence, string ToMax);

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
    string? Drill = null);

/// <summary>Scores delivery from measured numbers, so it can't be inflated by the model.</summary>
public static class Delivery
{
    public const int MinWpm = 110, MaxWpm = 160, MinSeconds = 45;
    public const double MaxFillersPerMinute = 2;

    public static Criterion Score(SpeechMetrics m)
    {
        var fillersPerMin = m.FillerTotal / (Math.Max(m.DurationSec, 1) / 60.0);
        var fixes = new List<string>();
        if (m.WordsPerMinute < MinWpm) fixes.Add($"говорить чуть быстрее (сейчас {m.WordsPerMinute} сл/мин, норма {MinWpm}–{MaxWpm})");
        else if (m.WordsPerMinute > MaxWpm) fixes.Add($"говорить чуть медленнее (сейчас {m.WordsPerMinute} сл/мин, норма {MinWpm}–{MaxWpm})");
        if (fillersPerMin > MaxFillersPerMinute) fixes.Add("заменить слова-паразиты паузой");
        if (m.DurationSec < MinSeconds) fixes.Add($"говорить не меньше {MinSeconds} секунд");

        var points = fixes.Count switch { 0 => 2, 1 => 1, _ => 0 };
        var evidence = string.Create(System.Globalization.CultureInfo.InvariantCulture,
            $"{m.WordsPerMinute} сл/мин · {fillersPerMin:0.#} паразит./мин · {m.DurationSec} с");
        var toMax = fixes.Count == 0 ? "" : char.ToUpperInvariant(fixes[0][0]) + string.Join("; ", fixes)[1..];
        return new Criterion(points, evidence, toMax);
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
