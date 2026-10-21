using System.Text.RegularExpressions;

namespace Govori.Core;

public static partial class SpeechAnalyzer
{
    [GeneratedRegex(@"[\p{L}]+(?:-[\p{L}]+)*")]
    private static partial Regex WordRegex();

    /// <param name="singleFillers">Single-word fillers ("слова-паразиты"), lower case.</param>
    /// <param name="phraseFillers">Multi-word fillers, lower case.</param>
    public static SpeechMetrics Analyze(
        string transcript, int durationSec, IReadOnlySet<string> singleFillers, IEnumerable<string> phraseFillers)
    {
        var text = transcript.ToLowerInvariant().Replace('ё', 'е');
        var words = WordRegex().Matches(text).Select(m => m.Value).ToList();
        var fillers = new Dictionary<string, int>();

        foreach (var w in words)
        {
            var key = HesitationRegex().IsMatch(w.Replace("-", "")) ? "э-э" : singleFillers.Contains(w) ? w : null;
            if (key is not null)
                fillers[key] = fillers.GetValueOrDefault(key) + 1;
        }

        foreach (var phrase in phraseFillers)
        {
            var count = Regex.Matches(text, $@"(?<!\p{{L}}){Regex.Escape(phrase)}(?!\p{{L}})").Count;
            if (count > 0) fillers[phrase] = count;
        }

        var minutes = Math.Max(durationSec, 1) / 60.0;
        return new SpeechMetrics(durationSec, words.Count, (int)Math.Round(words.Count / minutes), fillers);
    }

    public const int MinWordsForEvaluation = 5;

    /// <summary>
    /// True when the transcript has no real speech: too few words, or the transcription model
    /// echoed its own prompt back (a known hallucination on silent audio).
    /// </summary>
    public static bool IsNoSpeech(string transcript, string transcriptionPrompt)
    {
        var words = Normalize(transcript);
        if (words.Count < MinWordsForEvaluation) return true;

        var prompt = string.Join(' ', Normalize(transcriptionPrompt));
        var text = string.Join(' ', words);
        return prompt.Length > 0 && (prompt.Contains(text) || text.Contains(prompt));
    }

    private static List<string> Normalize(string s) =>
        WordRegex().Matches(s.ToLowerInvariant().Replace('ё', 'е')).Select(m => m.Value).ToList();

    // "э", "ээ", "эм", "эмм", "мм", "ммм"
    [GeneratedRegex(@"^(э+м*|м{2,})$")]
    private static partial Regex HesitationRegex();
}
