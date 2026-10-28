# Distribution test checklist

## Verified on the development computer

- Frontend and monitor service build successfully.
- The packaged app automatically starts the self-contained monitor service.
- CPU, GPU, VRAM, RAM, and storage capacity update with real readings.
- Unsupported CPU, RAM, and storage temperatures display `N/A`.
- The monitor listens on loopback and rejects unauthenticated requests.
- The NSIS installer completes without development tools installed by it.
- The installed application starts and its monitor child process runs.
- Silent uninstall completes and removes the test installation directory.
- Project tests, npm audit, and NuGet vulnerability audit pass.

## Required second-computer testing

Before announcing the first public release, test the installer on a clean
Windows 11 x64 computer that does not have Node.js or the .NET SDK installed.
Verify:

- Installation, Start menu shortcut, desktop shortcut, launch, and uninstall
- Automatic detection of that machine’s CPU, GPU, RAM, and fixed drives
- NVIDIA, AMD, or Intel GPU readings as applicable
- Correct `N/A` behavior for unsupported temperatures
- Behavior under a standard non-administrator account
- Optional elevated launch for storage or motherboard sensor comparison
- Multi-GPU and multi-drive layout when such hardware is available
- Windows SmartScreen behavior for the unsigned installer
- Resume from sleep and reconnect behavior

Testing on at least one AMD GPU or Intel integrated GPU machine is recommended
because the development computer currently validates the NVIDIA path.
