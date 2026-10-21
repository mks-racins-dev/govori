using Govori.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Govori.Infrastructure;

/// <summary>Reads <see cref="AppSetting"/> values, cached briefly so database edits apply within a minute.</summary>
public class DbContentProvider(GovoriDbContext db, IMemoryCache cache) : IContentProvider
{
    public async Task<string> GetAsync(string key, CancellationToken ct) =>
        await cache.GetOrCreateAsync("setting:" + key, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
            var value = await db.AppSettings.Where(s => s.Key == key).Select(s => s.Value).FirstOrDefaultAsync(ct);
            return value ?? SettingDefaults.All.GetValueOrDefault(key) ?? "";
        }) ?? "";
}

/// <summary>Inserts missing content. Never overwrites rows, so edits made in the database win.</summary>
public static class ContentSeeder
{
    public static async Task SeedAsync(GovoriDbContext db, IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> uiTexts)
    {
        var categories = await db.Categories.ToDictionaryAsync(c => c.Name);
        for (var i = 0; i < TopicSeed.Categories.Length; i++)
        {
            var (name, description, badge) = TopicSeed.Categories[i];
            if (categories.ContainsKey(name)) continue;
            var category = new Category { Name = name, Description = description, Badge = badge, SortOrder = i };
            db.Categories.Add(category);
            categories[name] = category;
        }
        await db.SaveChangesAsync();

        var existingTopics = (await db.Topics.Select(t => new { t.CategoryId, t.Text }).ToListAsync())
            .Select(t => (t.CategoryId, t.Text)).ToHashSet();
        foreach (var (categoryName, texts) in TopicSeed.ByCategory)
        {
            var category = categories[categoryName];
            for (var i = 0; i < texts.Length; i++)
                if (!existingTopics.Contains((category.Id, texts[i])))
                    db.Topics.Add(new Topic { Text = texts[i], CategoryId = category.Id, Difficulty = 1 + i % 3 });
        }

        var settingKeys = await db.AppSettings.Select(s => s.Key).ToHashSetAsync();
        foreach (var (key, value) in SettingDefaults.All)
            if (!settingKeys.Contains(key))
                db.AppSettings.Add(new AppSetting { Key = key, Value = value });

        var textKeys = (await db.UiTexts.Select(t => new { t.Locale, t.Key }).ToListAsync())
            .Select(t => (t.Locale, t.Key)).ToHashSet();
        foreach (var (locale, texts) in uiTexts)
            foreach (var (key, value) in texts)
                if (!textKeys.Contains((locale, key)))
                    db.UiTexts.Add(new UiText { Locale = locale, Key = key, Value = value, UpdatedAt = DateTime.UtcNow });

        await db.SaveChangesAsync();
    }
}
