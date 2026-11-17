using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Govori.Core;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Govori.E2ETests;

/// <summary>
/// Runs the real API (all endpoints, auth, EF migrations, background evaluation worker) against a throwaway
/// Postgres container. Only the external AI providers are replaced with fakes, so tests are free and deterministic.
/// Requires Docker.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    private readonly string _container = "govori-e2e-" + Guid.NewGuid().ToString("N")[..8];
    private readonly string _storage = Path.Combine(Path.GetTempPath(), "govori-e2e-" + Guid.NewGuid().ToString("N"));
    private WebApplicationFactory<Program>? _factory;

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    public FakeEvaluator Evaluator { get; } = new();
    public FakeTranscriber Transcriber { get; } = new();

    public async Task InitializeAsync()
    {
        await Docker($"run -d --rm --name {_container} -e POSTGRES_USER=govori -e POSTGRES_PASSWORD=govori -e POSTGRES_DB=govori -p 127.0.0.1::5432 postgres:17");
        var port = (await Docker($"port {_container} 5432")).Trim().Split('\n')[0].Split(':').Last();
        await WaitForPostgres();

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment("E2E");
            b.UseSetting("ConnectionStrings:Db", $"Host=127.0.0.1;Port={port};Database=govori;Username=govori;Password=govori");
            b.UseSetting("Jwt:Key", "e2e-signing-key-0123456789-0123456789-0123456789");
            b.UseSetting("Auth:AllowDevLogin", "true");
            b.UseSetting("Storage:Path", _storage);
            b.UseSetting("OpenAI:ApiKey", "");
            b.UseSetting("Anthropic:ApiKey", "");
            b.UseSetting("Supabase:Url", "");
            b.ConfigureTestServices(s =>
            {
                s.AddSingleton<ITranscriber>(Transcriber);
                s.AddSingleton<ISpeechEvaluator>(Evaluator);
            });
        });
        _ = _factory.Server; // start host: runs migrations and seeding
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null) await _factory.DisposeAsync();
        await Docker($"rm -f {_container}", throwOnError: false);
        try { Directory.Delete(_storage, true); } catch { /* best effort */ }
    }

    public HttpClient Anonymous() => _factory!.CreateClient();

    /// <summary>A client signed in as a fresh user (dev device login, as the app does before Sign in with Apple).</summary>
    public async Task<HttpClient> SignIn(string? deviceId = null)
    {
        var http = _factory!.CreateClient();
        var res = await http.PostAsJsonAsync("/auth/dev", new { deviceId = deviceId ?? Guid.NewGuid().ToString() });
        res.EnsureSuccessStatusCode();
        var token = (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return http;
    }

    private async Task WaitForPostgres()
    {
        for (var i = 0; i < 60; i++)
        {
            if ((await Run("docker", $"exec {_container} pg_isready -U govori -d govori", false)).ok) return;
            await Task.Delay(1000);
        }
        throw new TimeoutException("Postgres container did not become ready");
    }

    private static async Task<string> Docker(string args, bool throwOnError = true)
    {
        var (ok, output) = await Run("docker", args, throwOnError);
        return output;
    }

    private static async Task<(bool ok, string output)> Run(string file, string args, bool throwOnError)
    {
        var p = Process.Start(new ProcessStartInfo(file, args) { RedirectStandardOutput = true, RedirectStandardError = true })!;
        var stdout = await p.StandardOutput.ReadToEndAsync();
        var stderr = await p.StandardError.ReadToEndAsync();
        await p.WaitForExitAsync();
        if (p.ExitCode != 0 && throwOnError) throw new InvalidOperationException($"{file} {args} failed: {stderr}");
        return (p.ExitCode == 0, stdout);
    }
}

[CollectionDefinition(Name)]
public class ApiTestGroup : ICollectionFixture<ApiFixture>
{
    public const string Name = "api";
}

public sealed class FakeTranscriber : ITranscriber
{
    public const string DefaultText =
        "Ну, если бы я стал президентом на час, я бы, как бы, первым делом отменил пробки. " +
        "Ну то есть сделал все светофоры зелёными. Типа для всех сразу. А потом выступил бы с короткой речью.";

    /// <summary>Text returned for the next transcriptions; null means <see cref="DefaultText"/>.</summary>
    public string? Next { get; set; }

    public Task<string> TranscribeAsync(Stream audio, string fileName, CancellationToken ct) => Task.FromResult(Next ?? DefaultText);
}

public sealed class FakeEvaluator : ISpeechEvaluator
{
    private int _failuresLeft;
    public int Score { get; set; } = 8;
    private int _calls;
    public int Calls => Volatile.Read(ref _calls);

    public void FailNext(int times) => _failuresLeft = times;

    public Task<EvaluationResult> EvaluateAsync(string topic, string transcript, SpeechMetrics metrics, CancellationToken ct)
    {
        Interlocked.Increment(ref _calls);
        if (Interlocked.Decrement(ref _failuresLeft) >= 0) throw new HttpRequestException("AI provider is down (simulated)");
        return Task.FromResult(new EvaluationResult(Score, new SubScores(8, 9, 7, 8, 8), "Хорошее выступление.",
            ["Чёткий старт"], ["Меньше «ну»"], ["Начинайте с главной мысли"]));
    }
}
