using System.Net;
using Govori.Core;

namespace Govori.Api;

/// <summary>Public HTML pages linked from App Store Connect: /privacy and /support.</summary>
public static class Pages
{
    public static void MapPages(this WebApplication app)
    {
        app.MapGet("/privacy", (IContentProvider content, IConfiguration config, CancellationToken ct) =>
            Render(content, config, PageDefaults.PrivacyKey, "Политика конфиденциальности — Говори!", ct));
        app.MapGet("/support", (IContentProvider content, IConfiguration config, CancellationToken ct) =>
            Render(content, config, PageDefaults.SupportKey, "Поддержка — Говори!", ct));
    }

    private static async Task<IResult> Render(
        IContentProvider content, IConfiguration config, string key, string title, CancellationToken ct)
    {
        var email = WebUtility.HtmlEncode(config["App:ContactEmail"] ?? "");
        var body = (await content.GetAsync(key, ct)).Replace("{email}", email);
        return Results.Content($$"""
            <!doctype html>
            <html lang="ru">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>{{WebUtility.HtmlEncode(title)}}</title>
              <style>
                body { margin: 0; background: #F2F2F4; color: #111; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; }
                main { max-width: 680px; margin: 0 auto; padding: 32px 20px 64px; }
                article { background: #fff; border-radius: 28px; padding: 28px 24px; }
                h1 { font-size: 28px; letter-spacing: -0.5px; margin: 0 0 8px; }
                h2 { font-size: 18px; margin: 28px 0 8px; }
                h3 { font-size: 16px; margin: 20px 0 4px; }
                .muted { color: #8E8E93; margin-top: 0; }
                a { color: #111; }
                ul { padding-left: 20px; }
              </style>
            </head>
            <body><main><article>
            {{body}}
            </article></main></body>
            </html>
            """, "text/html; charset=utf-8");
    }
}
