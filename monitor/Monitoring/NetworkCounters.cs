using System.Diagnostics;
using System.Net.NetworkInformation;
using ComputerMonitor.Contracts;

namespace ComputerMonitor.Monitoring;

public sealed class NetworkCounters
{
    private readonly Dictionary<string, Sample> _previous = new(StringComparer.OrdinalIgnoreCase);

    public NetworkTelemetry Read(MonitorSettings settings)
    {
        var adapters = ListCandidates();
        if (!settings.NetworkEnabled)
        {
            return new NetworkTelemetry(false, null, null, null, null, null, adapters);
        }

        if (adapters.Count == 0)
        {
            return new NetworkTelemetry(true, null, null, null, null, null, adapters);
        }

        var now = Stopwatch.GetTimestamp();
        var rates = new List<AdapterRate>(adapters.Count);
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (!IsCandidate(nic)) continue;
            if (!TryReadBytes(nic, out var rx, out var tx)) continue;
            var elapsed = 0d;
            double? down = 0;
            double? up = 0;
            if (_previous.TryGetValue(nic.Id, out var prior))
            {
                elapsed = (now - prior.Timestamp) / (double)Stopwatch.Frequency;
                down = ToMbps(prior.BytesReceived, rx, elapsed);
                up = ToMbps(prior.BytesSent, tx, elapsed);
            }
            _previous[nic.Id] = new Sample(rx, tx, now);
            var info = adapters.First(item => item.Id == nic.Id);
            rates.Add(new AdapterRate(info, down, up, (down ?? 0) + (up ?? 0), rx + tx));
        }

        PruneStale(adapters.Select(item => item.Id).ToHashSet(StringComparer.OrdinalIgnoreCase));
        if (rates.Count == 0)
        {
            return new NetworkTelemetry(true, null, null, null, null, null, adapters);
        }

        var selected = SelectAdapter(rates, settings.NetworkAdapterId);
        if (selected is null)
        {
            return new NetworkTelemetry(true, settings.NetworkAdapterId, null, null, null, null, adapters);
        }

        return new NetworkTelemetry(
            true,
            selected.Info.Id,
            selected.Info.Name,
            selected.Info.Kind,
            selected.DownloadMbps,
            selected.UploadMbps,
            adapters);
    }

    public static double? ToMbps(long previousBytes, long currentBytes, double elapsedSeconds)
    {
        if (elapsedSeconds <= 0) return 0;
        if (currentBytes < previousBytes) return 0;
        return (currentBytes - previousBytes) * 8d / elapsedSeconds / 1_000_000d;
    }

    public static bool IsVirtualDescription(string description)
    {
        string[] markers =
        [
            "virtual", "hyper-v", "vmware", "virtualbox", "vbox", "loopback", "pseudo",
            "teredo", "isatap", "6to4", "wan miniport", "bluetooth", "microsoft wi-fi direct",
            "microsoft hosted network", "tap-", "vpn", "tunnel"
        ];
        return markers.Any(marker => description.Contains(marker, StringComparison.OrdinalIgnoreCase));
    }

    public static bool IsCandidateType(NetworkInterfaceType type) =>
        type is NetworkInterfaceType.Ethernet
            or NetworkInterfaceType.Wireless80211
            or NetworkInterfaceType.GigabitEthernet
            or NetworkInterfaceType.FastEthernetT
            or NetworkInterfaceType.FastEthernetFx
            or NetworkInterfaceType.Ethernet3Megabit;

    private static IReadOnlyList<NetworkAdapterInfo> ListCandidates()
    {
        try
        {
            return NetworkInterface.GetAllNetworkInterfaces()
                .Where(IsCandidate)
                .Select(nic => new NetworkAdapterInfo(
                    nic.Id,
                    nic.Name,
                    Kind(nic.NetworkInterfaceType),
                    nic.OperationalStatus == OperationalStatus.Up))
                .ToArray();
        }
        catch (Exception)
        {
            return [];
        }
    }

    private static bool IsCandidate(NetworkInterface nic)
    {
        if (nic.NetworkInterfaceType is NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel) return false;
        if (!IsCandidateType(nic.NetworkInterfaceType)) return false;
        if (IsVirtualDescription(nic.Description) || IsVirtualDescription(nic.Name)) return false;
        return true;
    }

    private static bool TryReadBytes(NetworkInterface nic, out long received, out long sent)
    {
        received = 0;
        sent = 0;
        try
        {
            var stats = nic.GetIPStatistics();
            received = stats.BytesReceived;
            sent = stats.BytesSent;
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    private static AdapterRate? SelectAdapter(List<AdapterRate> rates, string? requestedId)
    {
        if (!string.IsNullOrWhiteSpace(requestedId))
        {
            return rates.FirstOrDefault(item => item.Info.Id.Equals(requestedId, StringComparison.OrdinalIgnoreCase));
        }

        var up = rates.Where(item => item.Info.Connected).ToArray();
        if (up.Length == 0) return null;
        if (up.Length == 1) return up[0];
        return up
            .OrderByDescending(item => item.ActivityMbps)
            .ThenByDescending(item => item.TotalBytes)
            .ThenBy(item => item.Info.Kind == "Wi-Fi")
            .First();
    }

    private static string Kind(NetworkInterfaceType type) =>
        type == NetworkInterfaceType.Wireless80211 ? "Wi-Fi" : "Ethernet";

    private void PruneStale(HashSet<string> liveIds)
    {
        foreach (var id in _previous.Keys.Where(id => !liveIds.Contains(id)).ToArray())
        {
            _previous.Remove(id);
        }
    }

    private readonly record struct Sample(long BytesReceived, long BytesSent, long Timestamp);

    private sealed record AdapterRate(
        NetworkAdapterInfo Info,
        double? DownloadMbps,
        double? UploadMbps,
        double ActivityMbps,
        long TotalBytes);
}
