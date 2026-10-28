namespace ComputerMonitor.Contracts;

public sealed record TelemetrySnapshot(
    DateTimeOffset Timestamp,
    ProcessorTelemetry Cpu,
    IReadOnlyList<GpuTelemetry> Gpus,
    MemoryTelemetry Memory,
    IReadOnlyList<StorageTelemetry> Storage,
    MonitorHealth Health);

public sealed record ProcessorTelemetry(
    string Name,
    double UsagePercent,
    double? TemperatureCelsius,
    ThermalState ThermalState,
    IReadOnlyList<double> CoreUsagePercent);

public sealed record GpuTelemetry(
    string Id,
    string Name,
    double? UsagePercent,
    double? TemperatureCelsius,
    double? HotspotTemperatureCelsius,
    double? VramUsagePercent,
    ThermalState ThermalState,
    ThermalState HotspotThermalState);

public sealed record MemoryTelemetry(
    double UsagePercent,
    double? TemperatureCelsius,
    ThermalState ThermalState);

public sealed record StorageTelemetry(
    string Id,
    string Name,
    string DriveLetters,
    string Kind,
    double UsedPercent,
    double? TemperatureCelsius,
    ThermalState ThermalState);

public sealed record MonitorHealth(
    string Status,
    bool Elevated,
    IReadOnlyList<string> Notes);

public enum ThermalState
{
    Unavailable,
    Normal,
    Warm,
    Hot
}
