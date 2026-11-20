using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using Govori.Core;

namespace Govori.Infrastructure;

public class OpenAiSpeechSynthesizer(
    HttpClient http, IContentProvider content, string apiKey, string model = "gpt-4o-mini-tts", string voice = "alloy")
    : ISpeechSynthesizer
{
    public async Task<byte[]> SynthesizeAsync(string text, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["model"] = model,
            ["voice"] = voice,
            ["input"] = text,
            ["instructions"] = await content.GetAsync(SettingKeys.ReviewVoiceInstructions, ct),
            ["response_format"] = "mp3",
        };
        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/audio/speech")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Speech synthesis failed ({(int)res.StatusCode}): {await res.Content.ReadAsStringAsync(ct)}");
        return await res.Content.ReadAsByteArrayAsync(ct);
    }
}
