using System.Text.Json;
using RemoteFlow.Core.Defaults;
using RemoteFlow.Core.Models;
using RemoteFlow.Core.Storage;

namespace RemoteFlow.Agent.Services;

public sealed class DeckStore
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly object _gate = new();
    private DeckState _state;

    public DeckStore()
    {
        _state = Load();
    }

    public DeckState Current
    {
        get { lock (_gate) return Clone(_state); }
    }

    public void Save(DeckState state)
    {
        lock (_gate)
        {
            _state = Clone(state);
            Persist(_state);
        }
    }

    public DeckProfile? GetProfile(string? id)
    {
        var state = Current;
        if (string.IsNullOrEmpty(id)) id = state.ActiveProfileId;
        return state.Profiles.FirstOrDefault(p => p.Id == id)
               ?? state.Profiles.FirstOrDefault();
    }

    public ActionDefinition? FindAction(string actionId, string? profileId = null)
    {
        var profile = GetProfile(profileId);
        var action = profile?.Actions.FirstOrDefault(a => a.Id == actionId);
        if (action is not null) return action;
        // search all profiles
        foreach (var p in Current.Profiles)
        {
            action = p.Actions.FirstOrDefault(a => a.Id == actionId);
            if (action is not null) return action;
        }
        return null;
    }

    private static DeckState Load()
    {
        AppPaths.EnsureCreated();
        if (!File.Exists(AppPaths.DeckFile))
        {
            var def = DefaultProfiles.Create();
            Persist(def);
            return def;
        }
        try
        {
            var json = File.ReadAllText(AppPaths.DeckFile);
            return JsonSerializer.Deserialize<DeckState>(json, JsonOpts) ?? DefaultProfiles.Create();
        }
        catch
        {
            return DefaultProfiles.Create();
        }
    }

    private static void Persist(DeckState state)
    {
        AppPaths.EnsureCreated();
        File.WriteAllText(AppPaths.DeckFile, JsonSerializer.Serialize(state, JsonOpts));
    }

    private static DeckState Clone(DeckState s) =>
        JsonSerializer.Deserialize<DeckState>(JsonSerializer.Serialize(s, JsonOpts), JsonOpts)!;
}
