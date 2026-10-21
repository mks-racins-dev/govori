using System.Text;
using System.Text.Json.Serialization;
using Govori.Api;
using Govori.Core;
using Govori.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

builder.Services.AddDbContext<GovoriDbContext>(o => o.UseNpgsql(config.GetConnectionString("Db")));
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddSingleton<IAudioStorage>(_ =>
    new LocalAudioStorage(Path.GetFullPath(config["Storage:Path"] ?? "audio-data")));

// Real AI providers are used only when keys are configured; otherwise mocks keep the app usable.
var openAiKey = config["OpenAI:ApiKey"];
if (string.IsNullOrWhiteSpace(openAiKey))
    builder.Services.AddSingleton<ITranscriber, MockTranscriber>();
else
    builder.Services.AddHttpClient<ITranscriber, OpenAiTranscriber>((http, sp) =>
        new OpenAiTranscriber(http, sp.GetRequiredService<IContentProvider>(), openAiKey,
            config["OpenAI:TranscribeModel"] ?? "gpt-4o-transcribe"));

var anthropicKey = config["Anthropic:ApiKey"];
if (string.IsNullOrWhiteSpace(anthropicKey))
    builder.Services.AddSingleton<ISpeechEvaluator, MockSpeechEvaluator>();
else
    builder.Services.AddHttpClient<ISpeechEvaluator, ClaudeEvaluator>((http, sp) =>
        new ClaudeEvaluator(http, sp.GetRequiredService<IContentProvider>(), anthropicKey,
            config["Anthropic:Model"] ?? "claude-sonnet-5-5"));

builder.Services.AddMemoryCache();
builder.Services.AddScoped<IContentProvider, DbContentProvider>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<AppleTokenValidator>();
builder.Services.AddHostedService<EvaluationWorker>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = config["Jwt:Issuer"],
            ValidateAudience = false,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)),
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<GovoriDbContext>();
    await db.Database.MigrateAsync();
    await ContentSeeder.SeedAsync(db, UiTextFiles.Load(Path.Combine(AppContext.BaseDirectory, "Content")));
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { ok = true }));
app.MapAuthEndpoints();
app.MapContentEndpoints();
app.MapTopicEndpoints();
app.MapAttemptEndpoints();
app.MapMeEndpoints();

app.Run();
