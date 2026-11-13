using System.Text.Json;
using RemoteFlow.Core.Defaults;
using RemoteFlow.Core.Models;
using RemoteFlow.Core.Storage;

namespace RemoteFlow.Agent.Services;

public sealed class ConfigStore
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly object _gate = new();
    private AgentConfig _config;

    public ConfigStore()
    {
        _config = Load();
    }

    public AgentConfig Current
    {
        get { lock (_gate) return Clone(_config); }
    }

    public void Update(Action<AgentConfig> mutate)
    {
        lock (_gate)
        {
            mutate(_config);
            Save(_config);
        }
    }

    public void Replace(AgentConfig config)
    {
        lock (_gate)
        {
            _config = Clone(config);
            Save(_config);
        }
    }

    private static AgentConfig Load()
    {
        AppPaths.EnsureCreated();
        if (!File.Exists(AppPaths.ConfigFile))
        {
            var def = DefaultProfiles.CreateDefaultConfig();
            Save(def);
            return def;
        }
        try
        {
            var json = File.ReadAllText(AppPaths.ConfigFile);
            return JsonSerializer.Deserialize<AgentConfig>(json, JsonOpts) ?? DefaultProfiles.CreateDefaultConfig();
        }
        catch
        {
            return DefaultProfiles.CreateDefaultConfig();
        }
    }

    private static void Save(AgentConfig config)
    {
        AppPaths.EnsureCreated();
        File.WriteAllText(AppPaths.ConfigFile, JsonSerializer.Serialize(config, JsonOpts));
    }

    private static AgentConfig Clone(AgentConfig c) =>
        JsonSerializer.Deserialize<AgentConfig>(JsonSerializer.Serialize(c, JsonOpts), JsonOpts)!;
}
