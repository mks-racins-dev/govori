using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Govori.Core;
using Govori.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Govori.Api;

public class TokenService(IConfiguration config)
{
    public string Issue(Guid userId)
    {
        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            claims: [new Claim(JwtRegisteredClaimNames.Sub, userId.ToString())],
            expires: DateTime.UtcNow.AddDays(90),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

/// <summary>Validates "Sign in with Apple" identity tokens against Apple's published keys.</summary>
public class AppleTokenValidator(IConfiguration config)
{
    private readonly ConfigurationManager<OpenIdConnectConfiguration> _apple = new(
        "https://appleid.apple.com/.well-known/openid-configuration",
        new OpenIdConnectConfigurationRetriever(),
        new HttpDocumentRetriever());

    public async Task<string> ValidateAsync(string identityToken, CancellationToken ct)
    {
        var oidc = await _apple.GetConfigurationAsync(ct);
        var result = await new JwtSecurityTokenHandler().ValidateTokenAsync(identityToken, new TokenValidationParameters
        {
            ValidIssuer = "https://appleid.apple.com",
            ValidAudience = config["Apple:BundleId"],
            IssuerSigningKeys = oidc.SigningKeys,
        });
        if (!result.IsValid) throw new SecurityTokenException("Invalid Apple token", result.Exception);
        return (string)result.Claims[JwtRegisteredClaimNames.Sub];
    }
}

public static class AuthEndpoints
{
    public record AppleLogin(string IdentityToken);
    public record DevLogin(string DeviceId);
    public record PasswordLogin(string Username, string Password);
    public record AuthResponse(string Token);

    public static void MapAuthEndpoints(this WebApplication app)
    {
        app.MapPost("/auth/apple", async (AppleLogin body, AppleTokenValidator apple, GovoriDbContext db, TokenService tokens, CancellationToken ct) =>
        {
            string sub;
            try { sub = await apple.ValidateAsync(body.IdentityToken, ct); }
            catch (SecurityTokenException) { return Results.Unauthorized(); }

            var user = await FindOrCreate(db, "apple:" + sub, ct);
            return Results.Ok(new AuthResponse(tokens.Issue(user.Id)));
        });

        // Username/password login for App Review only. Enabled when Review:Username and Review:Password are set.
        var reviewUser = app.Configuration["Review:Username"];
        var reviewPassword = app.Configuration["Review:Password"];
        if (!string.IsNullOrWhiteSpace(reviewUser) && !string.IsNullOrWhiteSpace(reviewPassword))
        {
            app.MapPost("/auth/password", async (PasswordLogin body, GovoriDbContext db, TokenService tokens, CancellationToken ct) =>
            {
                var ok = FixedTimeEquals(body.Username, reviewUser) & FixedTimeEquals(body.Password, reviewPassword);
                if (!ok) return Results.Unauthorized();
                var user = await FindOrCreate(db, "review:" + reviewUser, ct);
                return Results.Ok(new AuthResponse(tokens.Issue(user.Id)));
            });
        }

        // Device-based login for development, before an Apple Developer account is set up.
        if (app.Configuration.GetValue<bool>("Auth:AllowDevLogin"))
        {
            app.MapPost("/auth/dev", async (DevLogin body, GovoriDbContext db, TokenService tokens, CancellationToken ct) =>
            {
                if (string.IsNullOrWhiteSpace(body.DeviceId)) return Results.BadRequest();
                var user = await FindOrCreate(db, "dev:" + body.DeviceId, ct);
                return Results.Ok(new AuthResponse(tokens.Issue(user.Id)));
            });
        }
    }

    private static bool FixedTimeEquals(string? a, string b) =>
        System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(a ?? ""), Encoding.UTF8.GetBytes(b));

    private static async Task<User> FindOrCreate(GovoriDbContext db, string subject, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.AppleSub == subject, ct);
        if (user is not null) return user;

        user = new User { Id = Guid.NewGuid(), AppleSub = subject, CreatedAt = DateTime.UtcNow };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return user;
    }

    public static Guid UserId(this ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
}
