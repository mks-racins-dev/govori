using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Govori.Core;
using Microsoft.Extensions.Logging;

namespace Govori.Infrastructure;

/// <summary>
/// Voices the review with an audio-capable chat model (gpt-audio), which sounds far livelier in Russian than
/// the plain TTS models. Such a model may reword the text, so what it said is checked against the text and the
/// review is voiced again if it drifted. The result is then sped up with ffmpeg (pitch is kept).
/// </summary>
public partial class OpenAiSpeechSynthesizer(
    HttpClient http, IContentProvider content, ILogger<OpenAiSpeechSynthesizer> log, string apiKey,
    string model = "gpt-audio", string voice = "coral", double speed = 1.2)
    : ISpeechSynthesizer
{
    private const int MaxAttempts = 3;
    public const double MinSimilarity = 0.9;

    public async Task<byte[]> SynthesizeAsync(string text, CancellationToken ct)
    {
        var instructions = await content.GetAsync(SettingKeys.ReviewVoiceInstructions, ct);
        (byte[] Audio, double Similarity)? best = null;
        for (var attempt = 0; attempt < MaxAttempts; attempt++)
        {
            var (audio, spoken) = await VoiceAsync(text, instructions, ct);
            var similarity = Similarity(text, spoken);
            if (best is null || similarity > best.Value.Similarity) best = (audio, similarity);
            if (similarity >= MinSimilarity && SameNumbers(text, spoken)) break;
            log.LogWarning("Voiced review drifted from the text (similarity {Similarity:0.00}), voicing again", similarity);
        }
        // Even the best attempt can drift a little; a slightly reworded review beats no review.
        return await SpeedUpAsync(best!.Value.Audio, ct);
    }

    private async Task<(byte[] Audio, string Transcript)> VoiceAsync(string text, string instructions, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["model"] = model,
            ["modalities"] = new JsonArray("text", "audio"),
            ["audio"] = new JsonObject { ["voice"] = voice, ["format"] = "mp3" },
            ["messages"] = new JsonArray(
                new JsonObject { ["role"] = "system", ["content"] = instructions },
                new JsonObject { ["role"] = "user", ["content"] = text }),
        };
        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var res = await http.SendAsync(req, ct);
        var json = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"Speech synthesis failed ({(int)res.StatusCode}): {json}");

        using var doc = JsonDocument.Parse(json);
        var audio = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("audio");
        return (Convert.FromBase64String(audio.GetProperty("data").GetString()!),
            audio.TryGetProperty("transcript", out var t) ? t.GetString() ?? "" : "");
    }

    /// <summary>Speeds the MP3 up keeping the pitch. Without ffmpeg (local runs) the audio is returned as is.</summary>
    private async Task<byte[]> SpeedUpAsync(byte[] mp3, CancellationToken ct)
    {
        if (Math.Abs(speed - 1) < 0.01) return mp3;
        try
        {
            var psi = new ProcessStartInfo("ffmpeg",
                ["-v", "error", "-i", "pipe:0", "-filter:a", $"atempo={speed.ToString(CultureInfo.InvariantCulture)}",
                 "-f", "mp3", "pipe:1"])
            {
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            using var p = Process.Start(psi)!;
            var output = new MemoryStream();
            var read = p.StandardOutput.BaseStream.CopyToAsync(output, ct);
            var errors = p.StandardError.ReadToEndAsync(ct);
            await p.StandardInput.BaseStream.WriteAsync(mp3, ct);
            p.StandardInput.Close();
            await Task.WhenAll(read, errors, p.WaitForExitAsync(ct));
            if (p.ExitCode == 0 && output.Length > 0) return output.ToArray();
            log.LogWarning("ffmpeg failed ({Code}): {Errors}", p.ExitCode, errors.Result);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogWarning(ex, "ffmpeg is unavailable; the review is not sped up");
        }
        return mp3;
    }

    [GeneratedRegex(@"\p{L}+|\d+")]
    private static partial Regex WordRegex();

    private static List<string> Words(string s) =>
        WordRegex().Matches(s.ToLowerInvariant().Replace('ё', 'е')).Select(m => m.Value).ToList();

    /// <summary>Share of the text's words that were spoken in order (longest common subsequence), 0–1.</summary>
    public static double Similarity(string text, string spoken)
    {
        var a = Words(text);
        var b = Words(spoken);
        if (a.Count == 0) return 1;
        var prev = new int[b.Count + 1];
        var cur = new int[b.Count + 1];
        foreach (var w in a)
        {
            for (var j = 1; j <= b.Count; j++)
                cur[j] = w == b[j - 1] ? prev[j - 1] + 1 : Math.Max(prev[j], cur[j - 1]);
            (prev, cur) = (cur, prev);
        }
        return (double)prev[b.Count] / Math.Max(a.Count, b.Count);
    }

    /// <summary>The score and other numbers must be said exactly; a rewording elsewhere is less harmful.</summary>
    public static bool SameNumbers(string text, string spoken)
    {
        static IEnumerable<string> Numbers(string s) =>
            Words(s).Where(w => char.IsDigit(w[0]) || NumberWords.Contains(w)).Order();
        return Numbers(text).SequenceEqual(Numbers(spoken));
    }

    private static readonly HashSet<string> NumberWords =
    [
        "ноль", "один", "одна", "одно", "два", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
        "десять", "десяти", "нуля", "одного", "двух", "трех", "четырех", "пяти", "шести", "семи", "восьми", "девяти",
    ];
}
