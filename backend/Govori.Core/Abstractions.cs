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
    Task<string> TranscribeAsync(Stream audio, string fileName, CancellationToken ct);
}

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
    public const string EvaluationSystemPrompt = "evaluation.systemPrompt";
    public const string TranscriptionPrompt = "transcription.prompt";
    public const string FillersSingle = "fillers.single";   // one word per line
    public const string FillersPhrases = "fillers.phrases"; // one phrase per line
    public const string EvaluationFailed = "errors.evaluationFailed";
    public const string NoSpeech = "errors.noSpeech";
    public const string ReviewSystemPrompt = "review.systemPrompt";
    public const string ReviewVoiceInstructions = "review.voiceInstructions";
}

public record SpeechMetrics(int DurationSec, int WordCount, int WordsPerMinute, Dictionary<string, int> FillerWords)
{
    public int FillerTotal => FillerWords.Values.Sum();
}

public record SubScores(int Structure, int Relevance, int Vocabulary, int Fluency, int Pace);

public record EvaluationResult(
    int Score,
    SubScores SubScores,
    string Summary,
    List<string> Strengths,
    List<string> Improvements,
    List<string> Suggestions);

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
