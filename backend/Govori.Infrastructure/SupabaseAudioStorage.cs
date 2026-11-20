using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Govori.Core;

namespace Govori.Infrastructure;

/// <summary>
/// Stores audio in a private Supabase Storage bucket via its REST API.
/// Uses the project's secret (service role) key, so it must only run on the server.
/// </summary>
public class SupabaseAudioStorage(HttpClient http, string projectUrl, string secretKey, string bucket) : IAudioStorage
{
    private string ObjectUrl(string key) => $"{projectUrl.TrimEnd('/')}/storage/v1/object/{bucket}/{key}";

    public async Task SaveAsync(string key, Stream content, CancellationToken ct)
    {
        using var body = new StreamContent(content);
        body.Headers.ContentType = new MediaTypeHeaderValue(key.EndsWith(".mp3", StringComparison.Ordinal) ? "audio/mpeg" : "audio/mp4");
        using var req = Request(HttpMethod.Post, ObjectUrl(key));
        req.Content = body;
        req.Headers.Add("x-upsert", "true");
        await SendAsync(req, ct);
    }

    public async Task<Stream> OpenReadAsync(string key, CancellationToken ct)
    {
        using var req = Request(HttpMethod.Get, ObjectUrl(key));
        using var res = await SendAsync(req, ct);
        // Recordings are ~0.5 MB, so buffering keeps the stream seekable for range requests.
        var buffer = new MemoryStream();
        await res.Content.CopyToAsync(buffer, ct);
        buffer.Position = 0;
        return buffer;
    }

    public async Task DeleteAsync(string key, CancellationToken ct)
    {
        using var req = Request(HttpMethod.Delete, ObjectUrl(key));
        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode && res.StatusCode != HttpStatusCode.NotFound)
            throw new InvalidOperationException($"Supabase delete failed ({(int)res.StatusCode}): {await res.Content.ReadAsStringAsync(ct)}");
    }

    /// <summary>Creates the private bucket if it does not exist yet. Called once at startup.</summary>
    public async Task EnsureBucketAsync(CancellationToken ct)
    {
        using var get = Request(HttpMethod.Get, $"{projectUrl.TrimEnd('/')}/storage/v1/bucket/{bucket}");
        using var existing = await http.SendAsync(get, ct);
        if (existing.IsSuccessStatusCode) return;

        using var create = Request(HttpMethod.Post, $"{projectUrl.TrimEnd('/')}/storage/v1/bucket");
        create.Content = JsonContent.Create(new { id = bucket, name = bucket, @public = false });
        using var _ = await SendAsync(create, ct);
    }

    private HttpRequestMessage Request(HttpMethod method, string url)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.Add("apikey", secretKey);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", secretKey);
        return req;
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
    {
        var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync(ct);
            res.Dispose();
            throw new InvalidOperationException($"Supabase {req.Method} {req.RequestUri?.AbsolutePath} failed ({(int)res.StatusCode}): {body}");
        }
        return res;
    }
}
