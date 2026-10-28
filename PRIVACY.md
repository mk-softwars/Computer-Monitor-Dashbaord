# Privacy

This page describes what Computer Monitor Dashboard does with data, based on
the current application source. It is not a claim that the computer never
uses the network for any reason.

## Summary

The application is designed to monitor **this computer only**. It does not
create an account, show advertisements, or include an analytics or crash-
reporting service.

Hardware readings are collected by a local service and shown in the local
window. They are not uploaded to the developer.

## What is processed

While the app is running it reads, where available:

- CPU name, utilization, optional per-core utilization, and temperature
- GPU name, utilization, temperature, hotspot temperature, and VRAM use
- Physical RAM utilization and memory temperature if a sensor exists
- Fixed-drive names, letters, occupied capacity, and drive temperature if a
  sensor exists
- Window layout, display mode, and the settings you choose

Missing sensors are shown as **N/A**. The app does not invent replacement
values.

## Where that data goes

1. **Local monitor service.** `ComputerMonitor.Service.exe` starts with the
   app, binds to a random port on `127.0.0.1` only, and requires a new
   random token each launch. The dashboard talks to it over HTTP and
   WebSocket on that loopback address.
2. **On-screen display.** Readings appear in the dashboard, Bar, Mini, or
   Desktop Background window.
3. **Local settings files.** Display preferences and window position are
   stored on this PC:
   - Electron user data, including `window-state.json`
   - Browser `localStorage` key `computer-monitor-settings`
4. **Windows startup (optional).** If you enable **Start with Windows**, the
   packaged app asks Windows to launch it at sign-in. That setting is stored
   by Windows, not by a cloud account.

The monitor service keeps refresh interval and temperature thresholds in
memory for that session. Closing the app stops the service.

Uninstalling the NSIS installer does **not** automatically delete app data
(`deleteAppDataOnUninstall` is off). Leftover settings may remain under the
Windows user profile until you delete them.

## What the source does not do

Reviewed application code does **not**:

- Send hardware telemetry to the developer
- Implement Google Analytics, advertising SDKs, or similar trackers
- Implement crash-report upload
- Check GitHub or another server for updates
- Require a login or API key

Optional GitHub Release update notifications are described as a possible
future feature in [Updates](docs/UPDATES.md) and are **not implemented**.

## Network behavior to be aware of

- Loopback (`127.0.0.1`) traffic between the window and the local service is
  expected.
- If a window tries to open an `https://` address, Electron may hand it to
  your default browser. The app does not browse the web as part of monitoring.
- Electron and Chromium are general-purpose runtimes. They may perform
  ordinary operating-system or certificate activity outside this project’s
  own source. That is not the same as this app uploading your CPU or GPU
  readings.

## Screenshots for developers

If the environment variable `DASHBOARD_SCREENSHOT_PATH` is set, the
development/main process can write a PNG of the window. Typical installed
copies do not set this variable.

## Questions

Security issues should follow [SECURITY.md](SECURITY.md) rather than a public
issue that includes exploit details or serial numbers.
