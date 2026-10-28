# Computer Monitor Dashboard v1.1.1

Standalone Windows x64 installer. You do not need Cursor, Node.js, .NET, or
other development tools. Sensor data stays on this computer.

**v1.0.0 remains published.** This release does not replace that installer.

## Install

1. Download `Computer-Monitor-Dashboard-Setup.exe`.
2. Run the installer and choose a folder.
3. Launch **Computer Monitor Dashboard** from the Start menu or desktop.
4. Open **Settings → About** and confirm **Version 1.1.1**.

If an older copy is already installed, run this setup so Windows replaces that
per-user app. Shortcuts that still point at v1.0.0 will not show the new
Appearance or NETWORK features.

## What is new in 1.1.1

This GitHub Release is the public installer that includes the v1.1 features
and the follow-up settings fix so they actually appear in the installed app.

- **Settings → Appearance.** The Appearance category is visible. Choose
  **Original RGB** (default, unchanged neon dashboard), **90s** (classic
  Windows gray), or **Coding** (black-and-green terminal). The theme applies
  immediately on Full, Windowed, Bar, Mini, and Desktop Background, and is
  restored on the next launch.
- **Network speeds.** The full dashboard shows live **Download** and
  **Upload** in Mbps from this PC’s Ethernet or Wi-Fi interface counters (not
  an internet speed test). Idle traffic shows 0.0 Mbps. Unavailable adapters
  show N/A. Optional compact NET cell on Bar/Mini stays off by default.
- **Existing settings.** Saved v1.0.0 settings that did not yet have a
  network key still show Download and Upload on the full dashboard.

Existing CPU, GPU, RAM, VRAM, storage, overlay, Click-Through, Always on Top,
and opacity behavior is unchanged.

## Notes

- The build is unsigned, so Windows SmartScreen may warn until a future signed
  release.
- Exclusive fullscreen games can cover the overlay; borderless windowed usually
  works.
- Missing sensors show `N/A`. They are not estimated.
- Network values are local throughput, not a speed-test result and not browsing
  history.
