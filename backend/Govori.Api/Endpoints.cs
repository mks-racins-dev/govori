using System.Security.Claims;
using System.Text.Json;
using Govori.Core;
using Govori.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Govori.Api;

public static class Endpoints
{
    private const int DailyAttemptLimit = 20;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public record TopicDto(int Id, string Text, string Category);
    public record AttemptSummary(Guid Id, string Topic, string Category, AttemptStatus Status, int? Score, int DurationSec, DateTime CreatedAt);
    public record AttemptDetail(
        Guid Id, TopicDto Topic, AttemptStatus Status, int DurationSec, DateTime CreatedAt,
        string? Transcript, string? FailureReason, EvaluationResult? Evaluation, SpeechMetrics? Metrics, bool HasReviewAudio);
    public record MeDto(int Attempts, double? AverageScore, int? BestScore, int StreakDays);

    public record CategoryDto(string Name, string Description, string? Badge);
    public record UiTextsDto(string Locale, DateTime UpdatedAt, Dictionary<string, string> Texts);

    public static void MapContentEndpoints(this WebApplication app)
    {
        // Anonymous: the app needs its texts before the user signs in.
        app.MapGet("/content/texts", async (string? locale, GovoriDbContext db) =>
        {
            locale ??= "ru";
            var rows = await db.UiTexts.Where(t => t.Locale == locale).ToListAsync();
            return new UiTextsDto(locale,
                rows.Count == 0 ? DateTime.MinValue : rows.Max(r => r.UpdatedAt),
                rows.ToDictionary(r => r.Key, r => r.Value));
        });

        app.MapGet("/categories", async (GovoriDbContext db) =>
            await db.Categories.Where(c => c.IsActive).OrderBy(c => c.SortOrder)
                .Select(c => new CategoryDto(c.Name, c.Description, c.Badge)).ToListAsync())
            .RequireAuthorization();
    }

    public static void MapTopicEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/topics").RequireAuthorization();

        g.MapGet("/random", async (string? category, int? exclude, ClaimsPrincipal user, GovoriDbContext db) =>
        {
            var userId = user.UserId();
            var query = db.Topics.Where(t => t.IsActive && t.Category!.IsActive);
            if (!string.IsNullOrWhiteSpace(category)) query = query.Where(t => t.Category!.Name == category);
            if (exclude is not null) query = query.Where(t => t.Id != exclude);

            var used = db.Attempts.Where(a => a.UserId == userId).Select(a => a.TopicId);
            var topic = await query.Where(t => !used.Contains(t.Id)).OrderBy(_ => EF.Functions.Random())
                            .Select(t => new TopicDto(t.Id, t.Text, t.Category!.Name)).FirstOrDefaultAsync()
                        ?? await query.OrderBy(_ => EF.Functions.Random())
                            .Select(t => new TopicDto(t.Id, t.Text, t.Category!.Name)).FirstOrDefaultAsync();

            return topic is null ? Results.NotFound() : Results.Ok(topic);
        });
    }

    public static void MapAttemptEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/attempts").RequireAuthorization();

        g.MapPost("/", async (HttpRequest req, ClaimsPrincipal user, GovoriDbContext db, IAudioStorage storage,
            ILogger<AttemptLog> log, CancellationToken ct) =>
        {
            var userId = user.UserId();
            if (!req.HasFormContentType)
                return Reject(log, $"expected multipart form, got '{req.ContentType}'");

            var form = await req.ReadFormAsync(ct);
            var audio = form.Files["audio"];
            if (audio is null || audio.Length == 0)
                return Reject(log, $"missing or empty audio (files: {string.Join(", ", form.Files.Select(f => $"{f.Name}={f.Length}b"))})");
            if (!int.TryParse(form["topicId"], out var topicId) || !int.TryParse(form["durationSec"], out var durationSec))
                return Reject(log, $"bad fields topicId='{form["topicId"]}' durationSec='{form["durationSec"]}'");
            if (!await db.Topics.AnyAsync(t => t.Id == topicId, ct))
                return Reject(log, $"unknown topic {topicId}");

            var since = DateTime.UtcNow.AddDays(-1);
            if (await db.Attempts.CountAsync(a => a.UserId == userId && a.CreatedAt > since, ct) >= DailyAttemptLimit)
                return Results.StatusCode(StatusCodes.Status429TooManyRequests);

            var attempt = new Attempt
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TopicId = topicId,
                DurationSec = Math.Clamp(durationSec, 0, 120),
                Status = AttemptStatus.Processing,
                CreatedAt = DateTime.UtcNow,
            };
            attempt.AudioKey = $"{userId}/{attempt.Id}.m4a";

            await using (var stream = audio.OpenReadStream())
                await storage.SaveAsync(attempt.AudioKey, stream, ct);

            db.Attempts.Add(attempt);
            await db.SaveChangesAsync(ct);
            EvaluationWorker.Wake();
            return Results.Ok(new { id = attempt.Id });
        }).DisableAntiforgery();

        g.MapGet("/", async (int? skip, int? take, ClaimsPrincipal user, GovoriDbContext db) =>
        {
            var userId = user.UserId();
            return await db.Attempts
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.CreatedAt)
                .Skip(skip ?? 0).Take(Math.Clamp(take ?? 50, 1, 100))
                .Select(a => new AttemptSummary(a.Id, a.Topic!.Text, a.Topic.Category!.Name, a.Status,
                    a.Evaluation == null ? null : a.Evaluation.Score, a.DurationSec, a.CreatedAt))
                .ToListAsync();
        });

        g.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipal user, GovoriDbContext db) =>
        {
            var a = await db.Attempts.Include(x => x.Topic).ThenInclude(t => t!.Category).Include(x => x.Evaluation)
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == user.UserId());
            if (a is null) return Results.NotFound();

            var stored = a.Evaluation is null ? null : JsonSerializer.Deserialize<StoredEvaluation>(a.Evaluation.Json, Json);
            return Results.Ok(new AttemptDetail(a.Id, new TopicDto(a.Topic!.Id, a.Topic.Text, a.Topic.Category!.Name), a.Status,
                a.DurationSec, a.CreatedAt, a.Transcript, a.FailureReason, stored?.Result, stored?.Metrics, a.ReviewAudioKey != null));
        });

        g.MapGet("/{id:guid}/audio", async (Guid id, ClaimsPrincipal user, GovoriDbContext db, IAudioStorage storage, CancellationToken ct) =>
        {
            var a = await db.Attempts.FirstOrDefaultAsync(x => x.Id == id && x.UserId == user.UserId(), ct);
            return a is null ? Results.NotFound() : Results.Stream(await storage.OpenReadAsync(a.AudioKey, ct), "audio/mp4", enableRangeProcessing: true);
        });

        g.MapGet("/{id:guid}/review-audio", async (Guid id, ClaimsPrincipal user, GovoriDbContext db, IAudioStorage storage, CancellationToken ct) =>
        {
            var a = await db.Attempts.FirstOrDefaultAsync(x => x.Id == id && x.UserId == user.UserId(), ct);
            return a?.ReviewAudioKey is null
                ? Results.NotFound()
                : Results.Stream(await storage.OpenReadAsync(a.ReviewAudioKey, ct), "audio/mpeg", enableRangeProcessing: true);
        });

        g.MapPost("/{id:guid}/retry", async (Guid id, ClaimsPrincipal user, GovoriDbContext db) =>
        {
            var a = await db.Attempts.FirstOrDefaultAsync(x => x.Id == id && x.UserId == user.UserId());
            if (a is null) return Results.NotFound();
            if (a.Status != AttemptStatus.Failed) return Results.Conflict();

            a.Status = AttemptStatus.Processing;
            a.FailureReason = null;
            await db.SaveChangesAsync();
            EvaluationWorker.Wake();
            return Results.NoContent();
        });

        g.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal user, GovoriDbContext db, IAudioStorage storage, CancellationToken ct) =>
        {
            var a = await db.Attempts.Include(x => x.Evaluation).FirstOrDefaultAsync(x => x.Id == id && x.UserId == user.UserId(), ct);
            if (a is null) return Results.NotFound();

            await storage.DeleteAsync(a.AudioKey, ct);
            if (a.ReviewAudioKey is not null) await storage.DeleteAsync(a.ReviewAudioKey, ct);
            db.Attempts.Remove(a);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    public static void MapMeEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/me").RequireAuthorization();

        g.MapGet("/", async (ClaimsPrincipal user, GovoriDbContext db) =>
        {
            var userId = user.UserId();
            var scores = await db.Evaluations.Where(e => db.Attempts.Any(a => a.Id == e.AttemptId && a.UserId == userId))
                .Select(e => e.Score).ToListAsync();
            var days = await db.Attempts.Where(a => a.UserId == userId)
                .Select(a => a.CreatedAt.Date).Distinct().ToListAsync();

            return new MeDto(
                await db.Attempts.CountAsync(a => a.UserId == userId),
                scores.Count == 0 ? null : Math.Round(scores.Average(), 1),
                scores.Count == 0 ? null : scores.Max(),
                StreakDays(days));
        });

        // Required by App Store guideline 5.1.1(v): users must be able to delete their account in-app.
        g.MapDelete("/", async (ClaimsPrincipal user, GovoriDbContext db, IAudioStorage storage, CancellationToken ct) =>
        {
            var userId = user.UserId();
            var attempts = await db.Attempts.Include(a => a.Evaluation).Where(a => a.UserId == userId).ToListAsync(ct);
            foreach (var a in attempts)
            {
                await storage.DeleteAsync(a.AudioKey, ct);
                if (a.ReviewAudioKey is not null) await storage.DeleteAsync(a.ReviewAudioKey, ct);
            }
            db.Attempts.RemoveRange(attempts);
            await db.Users.Where(u => u.Id == userId).ExecuteDeleteAsync(ct);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    public class AttemptLog;

    private static IResult Reject(ILogger log, string reason)
    {
        log.LogWarning("Upload rejected: {Reason}", reason);
        return Results.BadRequest(new { error = reason });
    }

    public static int StreakDays(IEnumerable<DateTime> activeDays)
    {
        var set = activeDays.Select(d => d.Date).ToHashSet();
        var day = DateTime.UtcNow.Date;
        if (!set.Contains(day)) day = day.AddDays(-1); // streak still counts if today isn't done yet
        var streak = 0;
        while (set.Contains(day)) { streak++; day = day.AddDays(-1); }
        return streak;
    }
}
