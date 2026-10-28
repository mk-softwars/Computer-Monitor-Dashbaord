# Reddit introduction draft (do not post until approved)

Suggested communities to consider later (read each subreddit’s rules first): r/Windows, r/software, r/hardware, r/pcmasterrace, r/electronics.

Do not post this automatically. Do not buy votes or fake accounts.

---

**Title:**
Free Windows hardware monitor with an RGB dashboard and a click-through overlay

**Body:**

I built Computer Monitor Dashboard, a local Windows hardware monitor for this PC.

It shows live CPU, GPU, RAM, VRAM, and storage usage. Temperatures appear only when the hardware actually exposes a sensor. Otherwise the UI shows N/A instead of a guessed value.

There is a full RGB dashboard, a floating Bar/Mini overlay (Always on Top, opacity, click-through), and a desktop-background mode. Click-through can be turned off from the tray or Ctrl+Shift+F10.

Windows x64 installer (no Node/.NET needed):
https://github.com/mk-softwars/Computer-Monitor-Dashbaord/releases/latest

Source, privacy notes, and disclaimer:
https://github.com/mk-softwars/Computer-Monitor-Dashbaord

Limitations I want to be upfront about:
- Many CPU/RAM/drive temperatures are N/A on ordinary PCs
- Exclusive fullscreen games can cover the overlay
- Desktop Background is not wallpaper and does not sit under icons
- The current installer is unsigned, so SmartScreen may warn
- NVIDIA was the GPU path I verified on my development machine

Independent project. Not affiliated with Dell or Alienware. MIT license. Bug reports and feature ideas: GitHub Issues.
