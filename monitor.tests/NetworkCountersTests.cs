using System.Net.NetworkInformation;
using ComputerMonitor.Contracts;
using ComputerMonitor.Monitoring;
using Xunit;

namespace ComputerMonitor.Tests;

public sealed class NetworkCountersTests
{
    [Fact]
    public void ConvertsBytesPerSecondToMbps()
    {
        // 1,250,000 bytes in 1 second = 10 Mbps
        Assert.Equal(10, NetworkCounters.ToMbps(0, 1_250_000, 1));
    }

    [Fact]
    public void IdleIntervalIsZeroNotUnavailable() =>
        Assert.Equal(0, NetworkCounters.ToMbps(100, 100, 1));

    [Fact]
    public void CounterResetDoesNotInventASpike() =>
        Assert.Equal(0, NetworkCounters.ToMbps(5_000_000, 100, 1));

    [Fact]
    public void ZeroElapsedDoesNotDivideByZero() =>
        Assert.Equal(0, NetworkCounters.ToMbps(0, 1_000_000, 0));

    [Theory]
    [InlineData("Hyper-V Virtual Ethernet Adapter")]
    [InlineData("VMware Network Adapter")]
    [InlineData("WAN Miniport (IKEv2)")]
    [InlineData("Microsoft Wi-Fi Direct Virtual Adapter")]
    public void VirtualDescriptionsAreIgnored(string description) =>
        Assert.True(NetworkCounters.IsVirtualDescription(description));

    [Fact]
    public void PhysicalEthernetDescriptionIsKept() =>
        Assert.False(NetworkCounters.IsVirtualDescription("Intel Ethernet Connection"));

    [Fact]
    public void EthernetAndWifiTypesAreCandidates()
    {
        Assert.True(NetworkCounters.IsCandidateType(NetworkInterfaceType.Ethernet));
        Assert.True(NetworkCounters.IsCandidateType(NetworkInterfaceType.Wireless80211));
        Assert.False(NetworkCounters.IsCandidateType(NetworkInterfaceType.Loopback));
        Assert.False(NetworkCounters.IsCandidateType(NetworkInterfaceType.Tunnel));
    }

    [Fact]
    public void DisabledMonitoringDoesNotReportSpeeds()
    {
        var telemetry = new NetworkCounters().Read(new MonitorSettings { NetworkEnabled = false });
        Assert.False(telemetry.Enabled);
        Assert.Null(telemetry.DownloadMbps);
        Assert.Null(telemetry.UploadMbps);
    }

    [Fact]
    public void LiveCountersStayNonNegativeAndSelectOneAdapter()
    {
        var counters = new NetworkCounters();
        var settings = new MonitorSettings { NetworkEnabled = true };
        _ = counters.Read(settings);
        Thread.Sleep(250);
        var sample = counters.Read(settings);
        if (sample.DownloadMbps is { } down) Assert.True(down >= 0);
        if (sample.UploadMbps is { } up) Assert.True(up >= 0);
        if (sample.AdapterId is not null)
        {
            Assert.Contains(sample.Adapters, adapter => adapter.Id == sample.AdapterId);
            Assert.True(sample.Adapters.Count(adapter => adapter.Connected) >= 1);
        }
    }
}
