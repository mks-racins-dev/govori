using System.Net.Http.Headers;
using System.Text.Json;
using Govori.Core;

namespace Govori.Infrastructure;

public class OpenAiTranscriber(HttpClient http, IContentProvider content, string apiKey, string model = "gpt-4o-mini-transcribe") : ITranscriber
{
    public async Task<string> TranscribeAsync(Stream audio, string fileName, CancellationToken ct)
    {
        using var form = new MultipartFormDataContent();
        var file = new StreamContent(audio);
        file.Headers.ContentType = new MediaTypeHeaderValue("audio/mp4");
        form.Add(file, "file", fileName);
        form.Add(new StringContent(model), "model");
        form.Add(new StringContent("ru"), "language");
        form.Add(new StringContent("json"), "response_format");
        // Ask the model to keep hesitations so filler detection works.
        form.Add(new StringContent(await content.GetAsync(SettingKeys.TranscriptionPrompt, ct)), "prompt");

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/audio/transcriptions") { Content = form };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var res = await http.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"Transcription failed ({(int)res.StatusCode}): {body}");

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("text").GetString() ?? "";
    }
}
