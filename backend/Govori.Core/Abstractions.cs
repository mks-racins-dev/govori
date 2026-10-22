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

public interface ISpeechEvaluator
{
    Task<EvaluationResult> EvaluateAsync(string topic, string transcript, SpeechMetrics metrics, CancellationToken ct);
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
