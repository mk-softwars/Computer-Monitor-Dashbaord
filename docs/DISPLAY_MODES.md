# Display modes

## Full dashboard

The standard dashboard shows all detected CPU, GPU, memory, VRAM, storage, and
network readings. At the original window size the Original RGB layout matches
the original command-center design. Smaller windows use a responsive layout
without changing that default theme. Settings → Appearance can switch to the
90s or Coding theme; native window behavior, Always on Top, Click-Through, and
overlay size stay the same. Drag empty dashboard chrome or the top header to
move the window. Cards and buttons stay clickable.

**Full Dashboard** maximizes the window. **Windowed** uses the same dashboard
at a restored size.

## Floating bar monitor

The frameless 750×85 overlay presents CPU, GPU, RAM, VRAM, and primary storage
in one Xbox-style row. Optional download/upload Mbps can be added as a compact
NET cell from Settings → Network; it is off by default so the bar stays the
original width. It can stay above ordinary windows with Always on Top,
use Overlay Opacity from 10% to 100% (default 90%), and remember its position.

## Floating mini monitor

Mini uses the same overlay chrome and metrics as Bar. Compact and normal size
presets are available from Settings. Right-click the widget or use the system
tray to change mode, opacity, always-on-top, lock, click-through, or exit.

## Desktop background widget

Windows does not provide a stable public API for embedding an arbitrary
Electron window below desktop icons. Techniques that re-parent windows into
Explorer’s undocumented `WorkerW` hierarchy can break after Windows updates or
restart Explorer.

The application therefore uses a safe desktop-level mode:

- The full dashboard fills the work area.
- The widget is removed from the taskbar.
- Always-on-top is disabled.
- Mouse input passes through to the desktop.
- Regular application windows naturally cover it.
- Explorer, desktop icons, and the Windows shell are not modified.

Restore the full dashboard from the system tray.

## Click-through

When click-through is enabled on Bar or Mini, Windows mouse input passes through
the overlay to the application or game underneath. The overlay stays visible and
can remain Always on Top. Native click-through uses
`BrowserWindow.setIgnoreMouseEvents(true)` without forwarding mouse events into
Chromium.

Click-through is not applied to the full dashboard. Desktop Background always
passes mouse input so desktop icons stay usable.

Recovery:

- System tray: **Disable Click-Through**
- Global shortcut: **Ctrl+Shift+F10** by default (configurable in Settings)
- Returning to Full Dashboard turns native click-through off

Click-through will not enable if neither the tray nor the shortcut is available.
Exclusive fullscreen games can cover the overlay; borderless windowed and
borderless fullscreen usually work. The application does not inject input into
games.

## Persistence and disconnected monitors

Each display mode remembers its last size and position. At startup, stored
bounds are checked against all connected monitors. If the previous monitor is
missing, the window is safely placed on the primary display.

If the overlay is hidden, unclickable, or off-screen, see
[Troubleshooting](../TROUBLESHOOTING.md).
