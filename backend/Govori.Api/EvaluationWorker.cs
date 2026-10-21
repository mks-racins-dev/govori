using System.Text.Json;
using Govori.Core;
using Govori.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Govori.Api;

/// <summary>
/// Processes attempts in the Processing state: transcribe, analyze, evaluate, save.
/// The database is the queue, so pending work survives restarts. Single-instance by design.
/// </summary>
public class EvaluationWorker(IServiceScopeFactory scopes, ILogger<EvaluationWorker> log) : BackgroundService
{
    private static readonly SemaphoreSlim Signal = new(0);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static void Wake() => Signal.Release();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            Guid? next;
            using (var scope = scopes.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<GovoriDbContext>();
                next = await db.Attempts.Where(a => a.Status == AttemptStatus.Processing)
                    .OrderBy(a => a.CreatedAt).Select(a => (Guid?)a.Id).FirstOrDefaultAsync(stoppingToken);
            }

            if (next is null)
            {
                await Signal.WaitAsync(TimeSpan.FromSeconds(10), stoppingToken);
                continue;
            }

            await ProcessAsync(next.Value, stoppingToken);
        }
    }

    private async Task ProcessAsync(Guid attemptId, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<GovoriDbContext>();
        var attempt = await db.Attempts.Include(a => a.Topic).Include(a => a.Evaluation).FirstAsync(a => a.Id == attemptId, ct);

        try
        {
            if (attempt.Transcript is null)
            {
                await using var audio = sp.GetRequiredService<IAudioStorage>().OpenRead(attempt.AudioKey);
                attempt.Transcript = await sp.GetRequiredService<ITranscriber>().TranscribeAsync(audio, $"{attempt.Id}.m4a", ct);
                await db.SaveChangesAsync(ct);
            }

            var content = sp.GetRequiredService<IContentProvider>();
            if (SpeechAnalyzer.IsNoSpeech(attempt.Transcript, await content.GetAsync(SettingKeys.TranscriptionPrompt, ct)))
            {
                // Nothing to evaluate: don't send silence to the AI. Retrying the same audio won't help.
                attempt.Transcript = "";
                attempt.Status = AttemptStatus.Failed;
                attempt.FailureReason = await content.GetAsync(SettingKeys.NoSpeech, ct);
                await db.SaveChangesAsync(ct);
                return;
            }

            var metrics = SpeechAnalyzer.Analyze(attempt.Transcript, attempt.DurationSec,
                SettingDefaults.Lines(await content.GetAsync(SettingKeys.FillersSingle, ct)).ToHashSet(),
                SettingDefaults.Lines(await content.GetAsync(SettingKeys.FillersPhrases, ct)));
            var result = await sp.GetRequiredService<ISpeechEvaluator>()
                .EvaluateAsync(attempt.Topic!.Text, attempt.Transcript, metrics, ct);

            var json = JsonSerializer.Serialize(new StoredEvaluation(result, metrics), Json);
            if (attempt.Evaluation is null)
                db.Evaluations.Add(new Evaluation { AttemptId = attempt.Id, Score = result.Score, Json = json });
            else
                (attempt.Evaluation.Score, attempt.Evaluation.Json) = (result.Score, json);

            attempt.Status = AttemptStatus.Done;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogError(ex, "Evaluation failed for attempt {AttemptId}", attempt.Id);
            attempt.Status = AttemptStatus.Failed;
            attempt.FailureReason = await sp.GetRequiredService<IContentProvider>().GetAsync(SettingKeys.EvaluationFailed, ct);
        }

        await db.SaveChangesAsync(ct);
    }
}
