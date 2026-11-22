namespace Govori.Core;

/// <summary>
/// Estimates how clearly the speech was heard from the transcriber's token confidences.
/// A rough proxy for diction: noise and rare words lower it too, so it is shown but not scored.
/// </summary>
public static class Clarity
{
    /// <summary>A word counts as unclear when its least confident token is below this probability.</summary>
    public const double UnclearBelow = 0.4;
    public const int MaxUnclearWords = 3;

    /// <param name="tokens">Tokens in order with their log probabilities; a token starting with a space begins a word.</param>
    /// <returns>Share of clear words (0–1) and the least confident words; null clarity when there are no words.</returns>
    public static (double? Clarity, List<string> Unclear) FromTokens(IEnumerable<(string Token, double LogProb)> tokens)
    {
        var words = new List<(string Word, double Prob)>();
        var current = "";
        var minProb = 1.0;

        void Flush()
        {
            var word = new string(current.Where(c => char.IsLetter(c) || c == '-').ToArray()).Trim('-');
            if (word.Length > 0) words.Add((word, minProb));
            current = "";
            minProb = 1.0;
        }

        foreach (var (token, logProb) in tokens)
        {
            if (token.StartsWith(' ') || token.Any(c => !char.IsLetter(c) && c != '-')) Flush();
            current += token;
            if (token.Any(char.IsLetter)) minProb = Math.Min(minProb, Math.Exp(logProb));
        }
        Flush();

        if (words.Count == 0) return (null, []);
        var clear = words.Count(w => w.Prob >= UnclearBelow);
        var unclear = words.Where(w => w.Prob < UnclearBelow && w.Word.Length >= 3)
            .OrderBy(w => w.Prob)
            .Select(w => w.Word.ToLowerInvariant())
            .Distinct()
            .Take(MaxUnclearWords)
            .ToList();
        return (Math.Round((double)clear / words.Count, 2), unclear);
    }
}
