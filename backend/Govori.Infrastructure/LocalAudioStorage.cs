using Govori.Core;

namespace Govori.Infrastructure;

/// <summary>Stores audio on local disk. Swap for S3/R2/Azure Blob in production.</summary>
public class LocalAudioStorage(string rootPath) : IAudioStorage
{
    public async Task SaveAsync(string key, Stream content, CancellationToken ct)
    {
        var path = PathFor(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var file = File.Create(path);
        await content.CopyToAsync(file, ct);
    }

    public Stream OpenRead(string key) => File.OpenRead(PathFor(key));

    public void Delete(string key)
    {
        var path = PathFor(key);
        if (File.Exists(path)) File.Delete(path);
    }

    private string PathFor(string key) => Path.Combine(rootPath, key.Replace('/', Path.DirectorySeparatorChar));
}
