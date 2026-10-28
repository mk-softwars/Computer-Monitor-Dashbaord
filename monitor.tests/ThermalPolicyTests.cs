using ComputerMonitor.Contracts;
using ComputerMonitor.Monitoring;
using Xunit;

namespace ComputerMonitor.Tests;

public sealed class ThermalPolicyTests
{
    private readonly MonitorSettings _settings = new();

    [Fact]
    public void MissingSensorIsUnavailable() =>
        Assert.Equal(ThermalState.Unavailable, ThermalPolicy.Evaluate(null, "cpu", _settings));

    [Theory]
    [InlineData(74, ThermalState.Normal)]
    [InlineData(75, ThermalState.Warm)]
    [InlineData(90, ThermalState.Hot)]
    public void CpuThresholdsAreApplied(double temperature, ThermalState expected) =>
        Assert.Equal(expected, ThermalPolicy.Evaluate(temperature, "cpu", _settings));

    [Fact]
    public void HardwareClassesUseDifferentDefaults()
    {
        Assert.Equal(ThermalState.Normal, ThermalPolicy.Evaluate(50, "ssd", _settings));
        Assert.Equal(ThermalState.Warm, ThermalPolicy.Evaluate(50, "hdd", _settings));
    }

    [Fact]
    public void SettingsAreClampedAndPreserveDefaults()
    {
        var settings = new MonitorSettings
        {
            RefreshIntervalMs = 20,
            Thresholds = new() { ["cpu"] = new(150, 10) }
        }.Validated();
        Assert.Equal(500, settings.RefreshIntervalMs);
        Assert.Equal(115, settings.Thresholds["cpu"].Warm);
        Assert.Equal(116, settings.Thresholds["cpu"].Hot);
        Assert.True(settings.Thresholds.ContainsKey("gpuHotspot"));
    }
}
