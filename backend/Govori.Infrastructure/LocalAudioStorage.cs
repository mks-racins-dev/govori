using Govori.Core;

namespace Govori.Infrastructure;

/// <summary>Stores audio on local disk. Used in development; production uses <see cref="SupabaseAudioStorage"/>.</summary>
public class LocalAudioStorage(string rootPath) : IAudioStorage
{
    public async Task SaveAsync(string key, Stream content, CancellationToken ct)
    {
        var path = PathFor(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var file = File.Create(path);
        await content.CopyToAsync(file, ct);
    }

    public Task<Stream> OpenReadAsync(string key, CancellationToken ct) => Task.FromResult<Stream>(File.OpenRead(PathFor(key)));

    public Task DeleteAsync(string key, CancellationToken ct)
    {
        var path = PathFor(key);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    private string PathFor(string key) => Path.Combine(rootPath, key.Replace('/', Path.DirectorySeparatorChar));
}
