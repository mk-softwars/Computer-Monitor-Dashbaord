namespace ComputerMonitor.Contracts;

public sealed record MonitorSettings
{
    public int RefreshIntervalMs { get; init; } = 1000;
    public Dictionary<string, ThermalThreshold> Thresholds { get; init; } = ThermalThreshold.Defaults();

    public MonitorSettings Validated()
    {
        var interval = Math.Clamp(RefreshIntervalMs, 500, 10_000);
        var defaults = ThermalThreshold.Defaults();
        foreach (var (key, value) in Thresholds)
        {
            if (defaults.ContainsKey(key))
                defaults[key] = value.Validated();
        }
        return this with { RefreshIntervalMs = interval, Thresholds = defaults };
    }
}

public sealed record ThermalThreshold(double Warm, double Hot)
{
    public ThermalThreshold Validated()
    {
        var warm = Math.Clamp(Warm, 20, 115);
        var hot = Math.Clamp(Hot, warm + 1, 120);
        return new(warm, hot);
    }

    public static Dictionary<string, ThermalThreshold> Defaults() => new(StringComparer.OrdinalIgnoreCase)
    {
        ["cpu"] = new(75, 90),
        ["gpu"] = new(75, 88),
        ["gpuHotspot"] = new(90, 105),
        ["ssd"] = new(55, 70),
        ["hdd"] = new(45, 55),
        ["ram"] = new(60, 75)
    };
}
