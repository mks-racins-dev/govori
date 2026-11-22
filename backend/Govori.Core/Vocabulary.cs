using System.Text.RegularExpressions;

namespace Govori.Core;

/// <param name="Diversity">Share of distinct content words (0–1); higher is more varied.</param>
/// <param name="Repeats">Content words said too often, most repeated first, e.g. ("очень", 5).</param>
/// <param name="IsLow">Speech is monotonous enough to suggest a vocabulary drill.</param>
public record VocabularyStats(double Diversity, List<WordRepeat> Repeats, bool IsLow);

public record WordRepeat(string Word, int Count);

/// <summary>
/// Measures how varied the vocabulary is. Only content words count (4+ letters), and word forms are merged by
/// their first letters, so "понедельник" and "понедельника" are one word. Words from the topic are ignored:
/// repeating them is natural. Rough by design; shown and used to pick a drill, never scored.
/// </summary>
public static partial class Vocabulary
{
    public const int MinContentWords = 20;   // too little speech to judge below this
    public const double LowDiversity = 0.6;  // share of distinct content words
    public const int RepeatFrom = 3;         // a word said this many times counts as a repeat
    public const int MaxRepeats = 3;
    private const int StemLength = 5;
    private const int MinWordLength = 4;

    [GeneratedRegex(@"\p{L}+")]
    private static partial Regex WordRegex();

    /// <returns>Null when there are too few content words to judge.</returns>
    public static VocabularyStats? Analyze(string transcript, string topic, IReadOnlySet<string> fillers)
    {
        static string Norm(string s) => s.ToLowerInvariant().Replace('ё', 'е');
        static string Stem(string w) => w.Length > StemLength ? w[..StemLength] : w;

        var topicStems = WordRegex().Matches(Norm(topic)).Select(m => m.Value)
            .Where(w => w.Length >= MinWordLength).Select(Stem).ToHashSet();
        var words = WordRegex().Matches(Norm(transcript)).Select(m => m.Value)
            .Where(w => w.Length >= MinWordLength && !fillers.Contains(w) && !topicStems.Contains(Stem(w)))
            .ToList();
        if (words.Count < MinContentWords) return null;

        var byStem = words.GroupBy(Stem).ToList();
        var diversity = Math.Round((double)byStem.Count / words.Count, 2);
        var repeats = byStem.Where(g => g.Count() >= RepeatFrom)
            .OrderByDescending(g => g.Count())
            .Take(MaxRepeats)
            // Show the form that was actually said most often.
            .Select(g => new WordRepeat(g.GroupBy(w => w).OrderByDescending(f => f.Count()).First().Key, g.Count()))
            .ToList();

        return new VocabularyStats(diversity, repeats, diversity < LowDiversity || repeats.Any(r => r.Count > RepeatFrom));
    }
}
