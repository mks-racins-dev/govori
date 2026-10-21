using System.Text.Json;

namespace Govori.Api;

/// <summary>
/// Loads Content/ui.{locale}.json, generated from the app's built-in strings by
/// `npm run export-texts` in mobile/. Used only to seed keys that are missing in the database.
/// </summary>
public static class UiTextFiles
{
    public static IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> Load(string directory)
    {
        var result = new Dictionary<string, IReadOnlyDictionary<string, string>>();
        if (!Directory.Exists(directory)) return result;

        foreach (var path in Directory.GetFiles(directory, "ui.*.json"))
        {
            var locale = Path.GetFileNameWithoutExtension(path)["ui.".Length..];
            result[locale] = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(path))!;
        }
        return result;
    }
}
