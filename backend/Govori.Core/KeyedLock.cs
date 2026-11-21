namespace Govori.Core;

/// <summary>
/// An async mutex per key. An entry exists only while someone holds or waits for its key,
/// so locking many different keys over time does not accumulate memory.
/// </summary>
public sealed class KeyedLock<TKey> where TKey : notnull
{
    private readonly Dictionary<TKey, Entry> _entries = new();

    /// <summary>Keys currently held or waited for.</summary>
    public int Count
    {
        get { lock (_entries) return _entries.Count; }
    }

    public async Task<IDisposable> AcquireAsync(TKey key, CancellationToken ct)
    {
        Entry entry;
        lock (_entries)
        {
            if (!_entries.TryGetValue(key, out entry!))
                _entries[key] = entry = new Entry();
            entry.Users++;
        }

        try
        {
            await entry.Gate.WaitAsync(ct);
        }
        catch
        {
            Leave(key, entry);
            throw;
        }
        return new Releaser(this, key, entry);
    }

    private void Leave(TKey key, Entry entry)
    {
        lock (_entries)
        {
            if (--entry.Users == 0) _entries.Remove(key);
        }
    }

    // SemaphoreSlim needs disposing only if its AvailableWaitHandle was used, which it never is here.
    [System.Diagnostics.CodeAnalysis.SuppressMessage("Design", "CA1001", Justification = "WaitAsync only; no wait handle to free")]
    private sealed class Entry
    {
        public readonly SemaphoreSlim Gate = new(1, 1);
        public int Users; // guarded by _entries
    }

    private sealed class Releaser(KeyedLock<TKey> owner, TKey key, Entry entry) : IDisposable
    {
        private int _disposed;

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
            // Waiters already counted themselves in Users, so the entry outlives this release while they wait.
            entry.Gate.Release();
            owner.Leave(key, entry);
        }
    }
}
