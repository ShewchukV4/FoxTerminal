using System.Runtime.InteropServices;
using System.Windows.Forms;
using RemoteFlow.Core.Models;

namespace RemoteFlow.Input;

public sealed class MonitorService
{
    public IReadOnlyList<MonitorInfo> GetMonitors()
    {
        var list = new List<MonitorInfo>();
        var screens = Screen.AllScreens;
        for (var i = 0; i < screens.Length; i++)
        {
            var s = screens[i];
            list.Add(new MonitorInfo
            {
                Index = i,
                Name = s.DeviceName,
                X = s.Bounds.X,
                Y = s.Bounds.Y,
                Width = s.Bounds.Width,
                Height = s.Bounds.Height,
                IsPrimary = s.Primary
            });
        }
        return list;
    }

    public MonitorInfo? GetMonitor(int index)
    {
        var all = GetMonitors();
        return index >= 0 && index < all.Count ? all[index] : all.FirstOrDefault(m => m.IsPrimary);
    }
}
