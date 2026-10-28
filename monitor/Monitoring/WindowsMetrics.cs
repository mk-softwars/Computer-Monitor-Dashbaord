using System.Management;
using System.Runtime.InteropServices;

namespace ComputerMonitor.Monitoring;

public sealed class WindowsMetrics
{
    private ulong _previousIdle;
    private ulong _previousKernel;
    private ulong _previousUser;

    public double ReadCpuUsage()
    {
        if (!GetSystemTimes(out var idle, out var kernel, out var user)) return 0;
        var idleNow = ToUInt64(idle);
        var kernelNow = ToUInt64(kernel);
        var userNow = ToUInt64(user);
        var kernelDelta = kernelNow - _previousKernel;
        var userDelta = userNow - _previousUser;
        var total = kernelDelta + userDelta;
        var result = total == 0 || _previousKernel == 0
            ? 0
            : (total - (idleNow - _previousIdle)) * 100d / total;
        (_previousIdle, _previousKernel, _previousUser) = (idleNow, kernelNow, userNow);
        return Math.Clamp(result, 0, 100);
    }

    public double ReadMemoryUsage()
    {
        var status = new MemoryStatusEx();
        if (!GlobalMemoryStatusEx(status)) return 0;
        return Math.Clamp(status.MemoryLoad, 0, 100);
    }

    public IReadOnlyList<LogicalDrive> ReadDrives()
    {
        var metadata = ReadDriveMetadata();
        return DriveInfo.GetDrives()
            .Where(d => d.DriveType == DriveType.Fixed && d.IsReady && d.TotalSize > 0)
            .Select(d =>
            {
                var letter = d.Name[..2].ToUpperInvariant();
                metadata.TryGetValue(letter, out var info);
                var used = (d.TotalSize - d.AvailableFreeSpace) * 100d / d.TotalSize;
                return new LogicalDrive(letter, info?.Model ?? d.VolumeLabel.NullIfEmpty() ?? $"Local Disk ({letter})",
                    info?.Kind ?? "Storage", Math.Clamp(used, 0, 100));
            }).ToArray();
    }

    private static Dictionary<string, DriveMetadata> ReadDriveMetadata()
    {
        var result = new Dictionary<string, DriveMetadata>(StringComparer.OrdinalIgnoreCase);
        try
        {
            using var disks = new ManagementObjectSearcher("SELECT DeviceID, Model, MediaType FROM Win32_DiskDrive");
            foreach (ManagementObject disk in disks.Get())
            {
                var deviceId = disk["DeviceID"]?.ToString()?.Replace("\\", "\\\\");
                if (deviceId is null) continue;
                var model = disk["Model"]?.ToString()?.Trim() ?? "Storage Device";
                var media = disk["MediaType"]?.ToString() ?? "";
                var kind = model.Contains("SSD", StringComparison.OrdinalIgnoreCase) ||
                           media.Contains("SSD", StringComparison.OrdinalIgnoreCase) ? "SSD" : "HDD";
                using var partitions = new ManagementObjectSearcher(
                    $"ASSOCIATORS OF {{Win32_DiskDrive.DeviceID='{deviceId}'}} WHERE AssocClass=Win32_DiskDriveToDiskPartition");
                foreach (ManagementObject partition in partitions.Get())
                {
                    var partitionId = partition["DeviceID"]?.ToString()?.Replace("\\", "\\\\");
                    if (partitionId is null) continue;
                    using var logicals = new ManagementObjectSearcher(
                        $"ASSOCIATORS OF {{Win32_DiskPartition.DeviceID='{partitionId}'}} WHERE AssocClass=Win32_LogicalDiskToPartition");
                    foreach (ManagementObject logical in logicals.Get())
                    {
                        var name = logical["DeviceID"]?.ToString();
                        if (name is not null) result[name] = new(model, kind);
                    }
                }
            }
        }
        catch (ManagementException) { }
        catch (UnauthorizedAccessException) { }
        return result;
    }

    private static ulong ToUInt64(FileTime value) => ((ulong)value.High << 32) | value.Low;

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetSystemTimes(out FileTime idle, out FileTime kernel, out FileTime user);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GlobalMemoryStatusEx([In, Out] MemoryStatusEx status);

    [StructLayout(LayoutKind.Sequential)]
    private struct FileTime { public uint Low; public uint High; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private sealed class MemoryStatusEx
    {
        public uint Length = (uint)Marshal.SizeOf<MemoryStatusEx>();
        public uint MemoryLoad;
        public ulong TotalPhysical;
        public ulong AvailablePhysical;
        public ulong TotalPageFile;
        public ulong AvailablePageFile;
        public ulong TotalVirtual;
        public ulong AvailableVirtual;
        public ulong AvailableExtendedVirtual;
    }

    private sealed record DriveMetadata(string Model, string Kind);
}

public sealed record LogicalDrive(string Letter, string Name, string Kind, double UsedPercent);

file static class StringExtensions
{
    public static string? NullIfEmpty(this string value) => string.IsNullOrWhiteSpace(value) ? null : value;
}
