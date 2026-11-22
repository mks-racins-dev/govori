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

        // A topic from the old bank that is also in the new one gets the new fields once (while its genre is empty);
        // after that, edits made in the database win.
        var existingTopics = await db.Topics.ToDictionaryAsync(t => (t.CategoryId, t.Text));
        foreach (var item in TopicSeed.Topics)
        {
            var categoryId = categories[item.Category].Id;
            if (!existingTopics.TryGetValue((categoryId, item.Text), out var topic))
            {
                topic = new Topic { Text = item.Text, CategoryId = categoryId };
                db.Topics.Add(topic);
                existingTopics[(categoryId, item.Text)] = topic;
            }
            else if (topic.Genre != "") continue;

            (topic.Genre, topic.Technique, topic.Hint, topic.Difficulty, topic.IsActive) =
                (item.Genre, item.Technique, item.Hint, item.Difficulty, true);
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
