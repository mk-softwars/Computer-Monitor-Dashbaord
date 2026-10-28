# Troubleshooting

These steps match the current Windows application. They do not ask you to turn
off Windows Security, antivirus, or SmartScreen.

For download and first-run help, see the [README](README.md). For overlay
behavior, see [Display modes](docs/DISPLAY_MODES.md).

## CPU temperature displays N/A

**N/A** means this PC did not expose a CPU package or core-max temperature
the monitor could read. It is not a “cold” reading.

Try:

1. Confirm **LIVE MONITORING** appears in the top bar.
2. Install the current chipset or motherboard driver from the PC or CPU
   vendor, then restart the app.
3. Read the sensor note at the bottom of the full dashboard, if one is shown.
4. Optionally run the app once as administrator. Some storage sensors need
   elevation. Motherboard sensors are **not** enabled in this build.

If temperature stays N/A after that, the sensor is unavailable to this app on
this machine.

## Network speed displays N/A or 0.0 Mbps

**0.0 Mbps** means the selected Ethernet or Wi-Fi adapter had no measured
traffic in that one-second sample. **N/A** means no usable adapter reading
was available (disconnected, filtered virtual adapter, or counters could not
be read).

Network Monitoring uses local Windows interface byte counters. It does not run
an internet speed test and does not need administrator rights.

Try:

1. Confirm **Network Monitoring** is on in Settings → Network.
2. Set **Network Adapter** to Auto, or pick the Ethernet/Wi-Fi adapter that
   Windows is actually using.
3. Confirm the adapter is connected. Virtual adapters such as Hyper-V, VPN,
   and Wi-Fi Direct are ignored on purpose.
4. Transfer a file or open a page, then wait about one second. Idle links
   correctly stay at 0.0 Mbps.

## GPU temperature unavailable

GPU name, load, temperature, hotspot, and VRAM come from LibreHardwareMonitor
when the driver exposes them. The dashboard shows the **first** detected GPU.

Try:

1. Install the current NVIDIA, AMD, or Intel GPU driver.
2. Restart Windows, then open Computer Monitor Dashboard again.
3. If no GPU card appears, the note “No supported GPU sensor interface was
   detected” may show on the dashboard.

The development computer used for this project validated an NVIDIA GPU path.
AMD and Intel paths exist in the monitor code when those hardware types are
reported; they are not claimed as tested on this project’s development PC.

## Hardware sensor access failure

If the top status stays on **STARTING** or **RECONNECTING**:

1. Wait a few seconds. The local service starts with the window.
2. Allow `ComputerMonitor.Service.exe` in endpoint-security software if it
   blocked a child process. Do not turn the security product off.
3. Close the app from the tray (**Exit Application**) and open it again.
4. A second launch focuses the existing instance instead of starting two
   copies.

The service listens only on `127.0.0.1`. It does not need an internet
connection.

## Floating overlay not visible

Bar and Mini are small (about 750×85 pixels) and may sit on another monitor.

1. Right-click the tray icon and choose **Show Floating Bar Monitor** or
   **Show Floating Mini Monitor**.
2. In Settings → Display, use **Reset window position**.
3. On Bar or Mini, open overlay settings and use **Reset Overlay Position**.
4. Raise **Overlay Opacity** toward 100% if the bar is nearly invisible.

## Overlay hidden behind fullscreen games

Exclusive fullscreen games can cover any overlay. This app does not inject
into games or anti-cheat.

Use **borderless windowed** or **borderless fullscreen** if you want the bar
visible while you play. **Always on Top** keeps Bar and Mini above ordinary
windows; it does not guarantee coverage over exclusive fullscreen.

## Click-Through prevents mouse interaction

That is expected. Clicks pass through Bar or Mini to the window underneath.

Turn it off with any of these:

- Tray: **Disable Click-Through**
- The Click-Through shortcut (default **Ctrl+Shift+F10**; also
  Ctrl+Shift+O or Ctrl+Alt+C if you chose those in Settings)
- Return to **Full** or **Windowed** dashboard

If Click-Through will not enable, the tray icon or shortcut may be
unavailable. The app refuses to enable it when it cannot provide a way back.

## Application does not launch

1. Download again from
   [the latest GitHub Release](https://github.com/mk-softwars/Computer-Monitor-Dashbaord/releases/latest).
2. If SmartScreen appears, confirm the publisher path is this GitHub project,
   then use **More info** and **Run anyway** only if you trust that source.
   Do not disable SmartScreen.
3. Check that you installed the **x64** Windows setup on a 64-bit PC.
4. Look in Task Manager for **Computer Monitor Dashboard**. The app allows
   only one instance.

## Application window opens off-screen

1. Open Settings (tray **Settings…**, or **Ctrl+,** if the window can take
   keys).
2. Choose **Reset window position**.
3. For Bar or Mini, also try **Reset Overlay Position**.

The app stores the last size and position in local user data. If a monitor
was disconnected, it tries to place the window on a connected screen at
startup.

## High CPU or GPU resource consumption

The monitor wakes hardware sensors on the refresh interval you chose (0.5, 1,
2, or 5 seconds). Shorter intervals do more work.

Try:

1. Settings → General → **Monitoring refresh** → 2 or 5 seconds.
2. Settings → Appearance → enable **Reduced motion**.
3. Use Bar or Mini instead of a maximized full dashboard if you only need a
   strip of metrics.

This project does not publish a guaranteed CPU or GPU budget for the overlay.

## Desktop background mode not working

Desktop Background is **not** a Windows wallpaper and does **not** sit under
desktop icons.

It shows the full dashboard over the work area, removes the taskbar button,
turns Always on Top off, and passes mouse clicks through to the desktop.
Other apps cover it. Restore **Open Full Dashboard** from the tray.

If you expected widgets under icons, Windows does not offer a stable public
API for that, and this app does not modify Explorer.

## Windows security warnings

Current community builds, including **v1.1.1**, are **unsigned**. SmartScreen
or another filter may label them as unrecognized. **v1.0.0** remains on GitHub
Releases.

- Keep Windows Security enabled.
- Prefer the official
  [Releases](https://github.com/mk-softwars/Computer-Monitor-Dashbaord/releases/latest)
  download.
- SHA-256 checksum files are **not** attached to the current release, so this
  project cannot give you an official hash to compare yet.

## How to uninstall

1. Close the app: tray → **Exit Application**.
2. Open Windows **Settings** → **Apps** → **Installed apps**.
3. Select **Computer Monitor Dashboard** → **Uninstall**.

You can also run the uninstaller from the folder you chose during setup.

App data (window position and settings) may remain in your Windows user
profile after uninstall. Delete that folder only if you want a clean slate.
