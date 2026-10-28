using System.Security.Principal;
using ComputerMonitor.Contracts;
using LibreHardwareMonitor.Hardware;

namespace ComputerMonitor.Monitoring;

public sealed class HardwareMonitor : IDisposable
{
    private readonly Computer _computer;
    private readonly WindowsMetrics _windows = new();
    private readonly object _gate = new();

    public HardwareMonitor()
    {
        _computer = new Computer
        {
            IsCpuEnabled = true,
            IsGpuEnabled = true,
            IsMemoryEnabled = true,
            IsStorageEnabled = true,
            IsMotherboardEnabled = false,
            IsControllerEnabled = false,
            IsNetworkEnabled = false
        };
        _computer.Open();
        _ = _windows.ReadCpuUsage();
    }

    public TelemetrySnapshot Capture(MonitorSettings settings)
    {
        lock (_gate)
        {
            foreach (var hardware in _computer.Hardware) UpdateRecursively(hardware);
            var all = Flatten(_computer.Hardware).ToArray();
            var cpuHardware = all.FirstOrDefault(h => h.HardwareType == HardwareType.Cpu);
            var cpuTemp = PreferredTemperature(cpuHardware, "CPU Package", "Core Max");
            var cores = Sensors(cpuHardware, SensorType.Load)
                .Where(s => s.Name.StartsWith("CPU Core #", StringComparison.OrdinalIgnoreCase))
                .Select(s => Clamp(s.Value)).Where(v => v.HasValue).Select(v => v!.Value).ToArray();

            var cpu = new ProcessorTelemetry(
                cpuHardware?.Name ?? "Detected Processor",
                _windows.ReadCpuUsage(),
                cpuTemp,
                ThermalPolicy.Evaluate(cpuTemp, "cpu", settings),
                cores);

            var gpus = all.Where(IsGpu).Select(h => ReadGpu(h, settings)).ToArray();
            var memoryHardware = all.FirstOrDefault(h => h.HardwareType == HardwareType.Memory);
            var memoryTemp = PreferredTemperature(memoryHardware, "Memory", "DIMM");
            var memory = new MemoryTelemetry(
                _windows.ReadMemoryUsage(),
                memoryTemp,
                ThermalPolicy.Evaluate(memoryTemp, "ram", settings));

            var storageHardware = all.Where(h => h.HardwareType == HardwareType.Storage).ToArray();
            var drives = _windows.ReadDrives().Select((drive, index) =>
            {
                var physical = storageHardware.FirstOrDefault(h =>
                    h.Name.Contains(drive.Name, StringComparison.OrdinalIgnoreCase) ||
                    drive.Name.Contains(h.Name, StringComparison.OrdinalIgnoreCase));
                physical ??= storageHardware.Length == 1 ? storageHardware[0] : null;
                var temp = PreferredTemperature(physical, "Temperature", "Drive");
                var category = drive.Kind.Equals("SSD", StringComparison.OrdinalIgnoreCase) ? "ssd" : "hdd";
                return new StorageTelemetry(
                    $"{drive.Letter}-{index}",
                    drive.Name,
                    drive.Letter,
                    drive.Kind,
                    drive.UsedPercent,
                    temp,
                    ThermalPolicy.Evaluate(temp, category, settings));
            }).ToArray();

            var notes = new List<string>();
            if (cpuTemp is null) notes.Add("CPU temperature sensor is unavailable.");
            if (gpus.Length == 0) notes.Add("No supported GPU sensor interface was detected.");
            if (drives.Any(d => d.TemperatureCelsius is null))
                notes.Add("Some drive temperatures are not exposed by the device or driver.");
            if (!IsElevated())
                notes.Add("Running normally. Administrator mode may expose additional motherboard or storage sensors.");

            return new(DateTimeOffset.UtcNow, cpu, gpus, memory, drives,
                new MonitorHealth("online", IsElevated(), notes));
        }
    }

    private static GpuTelemetry ReadGpu(IHardware hardware, MonitorSettings settings)
    {
        var usage = FindValue(hardware, SensorType.Load, "GPU Core")
                    ?? Sensors(hardware, SensorType.Load)
                        .Where(s => s.Name.Contains("D3D", StringComparison.OrdinalIgnoreCase))
                        .Select(s => Clamp(s.Value)).Where(v => v.HasValue).DefaultIfEmpty().Max();
        var temp = PreferredTemperature(hardware, "GPU Core", "GPU Temperature");
        var hotspot = PreferredTemperature(hardware, "GPU Hot Spot", "Hot Spot", "Hotspot");
        var vram = FindValue(hardware, SensorType.Load, "GPU Memory");
        if (vram is null)
        {
            var used = FindByName(hardware, "GPU Memory Used");
            var total = FindByName(hardware, "GPU Memory Total");
            if (used is > 0 && total is > 0) vram = Math.Clamp(used.Value / total.Value * 100, 0, 100);
        }
        return new(
            hardware.Identifier.ToString(),
            hardware.Name,
            usage,
            temp,
            hotspot,
            vram,
            ThermalPolicy.Evaluate(temp, "gpu", settings),
            ThermalPolicy.Evaluate(hotspot, "gpuHotspot", settings));
    }

    private static bool IsGpu(IHardware h) =>
        h.HardwareType is HardwareType.GpuNvidia or HardwareType.GpuAmd or HardwareType.GpuIntel;

    private static void UpdateRecursively(IHardware hardware)
    {
        hardware.Update();
        foreach (var child in hardware.SubHardware) UpdateRecursively(child);
    }

    private static IEnumerable<IHardware> Flatten(IEnumerable<IHardware> hardware)
    {
        foreach (var item in hardware)
        {
            yield return item;
            foreach (var child in Flatten(item.SubHardware)) yield return child;
        }
    }

    private static IEnumerable<ISensor> Sensors(IHardware? hardware, SensorType? type = null) =>
        hardware?.Sensors.Where(s => type is null || s.SensorType == type) ?? [];

    private static double? PreferredTemperature(IHardware? hardware, params string[] preferred)
    {
        var temperatures = Sensors(hardware, SensorType.Temperature).Where(s => s.Value.HasValue).ToArray();
        foreach (var name in preferred)
        {
            var value = temperatures.FirstOrDefault(s => s.Name.Contains(name, StringComparison.OrdinalIgnoreCase))?.Value;
            if (value.HasValue) return value.Value;
        }
        return temperatures.Select(s => s.Value).Where(v => v.HasValue).Select(v => (double?)v!.Value).DefaultIfEmpty().Max();
    }

    private static double? FindValue(IHardware hardware, SensorType type, string name) =>
        Clamp(Sensors(hardware, type).FirstOrDefault(s =>
            s.Name.Equals(name, StringComparison.OrdinalIgnoreCase) ||
            s.Name.Contains(name, StringComparison.OrdinalIgnoreCase))?.Value);

    private static double? FindByName(IHardware hardware, string name) =>
        Sensors(hardware).FirstOrDefault(s => s.Name.Contains(name, StringComparison.OrdinalIgnoreCase))?.Value;

    private static double? Clamp(float? value) => value.HasValue ? Math.Clamp(value.Value, 0, 100) : null;

    private static bool IsElevated()
    {
        using var identity = WindowsIdentity.GetCurrent();
        return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
    }

    public void Dispose()
    {
        _computer.Close();
        GC.SuppressFinalize(this);
    }
}
