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

// Railway (and most PaaS hosts) tell the app which port to listen on via $PORT.
if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port)
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

if (string.IsNullOrWhiteSpace(config["Jwt:Key"]) || config["Jwt:Key"]!.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be set to a random string of at least 32 characters.");

builder.Services.AddDbContext<GovoriDbContext>(o => o.UseNpgsql(config.GetConnectionString("Db"), npgsql => npgsql.EnableRetryOnFailure()));
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// Supabase Storage when configured (production); local disk otherwise (development).
var supabaseUrl = config["Supabase:Url"];
if (string.IsNullOrWhiteSpace(supabaseUrl))
    builder.Services.AddSingleton<IAudioStorage>(_ =>
        new LocalAudioStorage(Path.GetFullPath(config["Storage:Path"] ?? "audio-data")));
else
    builder.Services.AddHttpClient<IAudioStorage, SupabaseAudioStorage>((http, _) =>
        new SupabaseAudioStorage(http, supabaseUrl, config["Supabase:SecretKey"]!, config["Supabase:Bucket"] ?? "recordings"));

// Real AI providers are used only when keys are configured; otherwise mocks keep the app usable.
var openAiKey = config["OpenAI:ApiKey"];
if (string.IsNullOrWhiteSpace(openAiKey))
    builder.Services.AddSingleton<ITranscriber, MockTranscriber>();
else
    builder.Services.AddHttpClient<ITranscriber, OpenAiTranscriber>((http, sp) =>
        new OpenAiTranscriber(http, sp.GetRequiredService<IContentProvider>(), openAiKey,
            config["OpenAI:TranscribeModel"] ?? "gpt-4o-mini-transcribe"));

// The spoken review needs OpenAI too; without a key the app shows the text review only.
// It is voiced on demand, when the user first presses play.
if (!string.IsNullOrWhiteSpace(openAiKey))
    builder.Services.AddHttpClient<ISpeechSynthesizer, OpenAiSpeechSynthesizer>((http, sp) =>
        new OpenAiSpeechSynthesizer(http, sp.GetRequiredService<IContentProvider>(), openAiKey,
            config["OpenAI:TtsModel"] ?? "gpt-4o-mini-tts", config["OpenAI:TtsVoice"] ?? "alloy"));

var anthropicKey = config["Anthropic:ApiKey"];
if (string.IsNullOrWhiteSpace(anthropicKey))
    builder.Services.AddSingleton<ISpeechEvaluator, MockSpeechEvaluator>();
else
    builder.Services.AddHttpClient<ISpeechEvaluator, ClaudeEvaluator>((http, sp) =>
        new ClaudeEvaluator(http, sp.GetRequiredService<IContentProvider>(), anthropicKey,
            config["Anthropic:Model"] ?? "claude-haiku-5-5"));


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

// The native app doesn't need CORS. In development the Expo web build runs on another localhost port.
if (builder.Environment.IsDevelopment())
    builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
        .SetIsOriginAllowed(origin => new Uri(origin).IsLoopback)
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<GovoriDbContext>();
    await db.Database.MigrateAsync();
    await ContentSeeder.SeedAsync(db, UiTextFiles.Load(Path.Combine(AppContext.BaseDirectory, "Content")));
    if (scope.ServiceProvider.GetRequiredService<IAudioStorage>() is SupabaseAudioStorage supabase)
        await supabase.EnsureBucketAsync(CancellationToken.None);
}

if (app.Environment.IsDevelopment()) app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { ok = true }));
app.MapPages();
app.MapAuthEndpoints();
app.MapContentEndpoints();
app.MapTopicEndpoints();
app.MapAttemptEndpoints();
app.MapMeEndpoints();

app.Run();
public partial class Program;
