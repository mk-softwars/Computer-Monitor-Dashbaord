using ComputerMonitor.Contracts;

namespace ComputerMonitor.Monitoring;

public sealed class SettingsStore
{
    private readonly object _gate = new();
    private MonitorSettings _value = new();

    public MonitorSettings Get()
    {
        lock (_gate) return _value with { Thresholds = new(_value.Thresholds, StringComparer.OrdinalIgnoreCase) };
    }

    public MonitorSettings Update(MonitorSettings settings)
    {
        lock (_gate)
        {
            _value = settings.Validated();
            return Get();
        }
    }
}
