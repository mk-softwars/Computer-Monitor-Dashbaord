# Computer Monitor Dashboard v1.1.0

Standalone Windows x64 installer. You do not need Cursor, Node.js, .NET, or
other development tools. Sensor data stays on this computer.

**v1.0.0 remains published.** This release does not replace that installer.

## Install

1. Download `Computer-Monitor-Dashboard-Setup.exe`.
2. Run the installer and choose a folder.
3. Launch **Computer Monitor Dashboard** from the Start menu or desktop.

## What is new in 1.1.0

- **Network speeds.** Live download and upload in Mbps from this PC’s Ethernet
  or Wi-Fi interface counters (not an internet speed test). Auto or manual
  adapter selection in Settings → Network. Idle traffic shows 0.0 Mbps.
  Unavailable adapters show N/A. Optional compact NET cell on Bar/Mini, off by
  default.
- **Themes.** Settings → Appearance: **Original RGB** (default, unchanged),
  **90s** (classic Windows gray), and **Coding** (black-and-green terminal).
  The choice applies immediately and is restored on the next launch.

Existing CPU, GPU, RAM, VRAM, storage, overlay, Click-Through, Always on Top,
and opacity behavior is unchanged. Original RGB still matches the v1.0.0 look.

## Notes

- The build is unsigned, so Windows SmartScreen may warn until a future signed
  release.
- Exclusive fullscreen games can cover the overlay; borderless windowed usually
  works.
- Missing sensors show `N/A`. They are not estimated.
- Network values are local throughput, not a speed-test result and not browsing
  history.
