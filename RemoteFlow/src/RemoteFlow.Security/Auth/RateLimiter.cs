using System.Collections.Concurrent;

namespace RemoteFlow.Security.Auth;

public sealed class RateLimiter
{
    private readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> _hits = new();
    private readonly int _max;
    private readonly TimeSpan _window;

    public RateLimiter(int maxPerWindow = 60, int windowSeconds = 60)
    {
        _max = maxPerWindow;
        _window = TimeSpan.FromSeconds(windowSeconds);
    }

    public bool Allow(string key)
    {
        var now = DateTimeOffset.UtcNow;
        var q = _hits.GetOrAdd(key, _ => new Queue<DateTimeOffset>());
        lock (q)
        {
            while (q.Count > 0 && now - q.Peek() > _window)
                q.Dequeue();
            if (q.Count >= _max) return false;
            q.Enqueue(now);
            return true;
        }
    }
}
