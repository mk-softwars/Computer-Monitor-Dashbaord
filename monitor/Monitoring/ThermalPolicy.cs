using ComputerMonitor.Contracts;

namespace ComputerMonitor.Monitoring;

public static class ThermalPolicy
{
    public static ThermalState Evaluate(double? temperature, string category, MonitorSettings settings)
    {
        if (temperature is null) return ThermalState.Unavailable;
        if (!settings.Thresholds.TryGetValue(category, out var threshold))
            return ThermalState.Unavailable;
        if (temperature >= threshold.Hot) return ThermalState.Hot;
        if (temperature >= threshold.Warm) return ThermalState.Warm;
        return ThermalState.Normal;
    }
}
