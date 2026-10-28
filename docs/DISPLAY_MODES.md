# Display modes

## Full dashboard

The standard responsive RGB dashboard shows all detected CPU, GPU, memory,
VRAM, and storage readings. The custom title bar supports drag, minimize,
maximize/restore, close-to-tray, and fullscreen.

## Floating bar monitor

The frameless horizontal monitor presents CPU usage and temperature, GPU usage
and temperature, RAM, VRAM, and primary fixed-drive capacity and temperature
in one row. It can be resized across monitors and optionally kept above other
applications.

## Floating mini monitor

The mini monitor contains the same eight live metrics in a layout that is 25%
smaller than the compact floating bar (540×57 instead of 720×76). Labels,
controls, and typography are condensed while dragging, position persistence,
opacity, locking, and always-on-top remain available.

Right-click the widget or use the system tray to change mode, opacity,
always-on-top, lock, click-through, or exit the application.

The Display Mode settings include clear **Panel transparency** levels: None,
Low, Medium, and High. Only the glass panel background fades, so telemetry
labels and values remain crisp and readable. Selecting a level disables the
conflicting text-only override. Text-only mode remains available when the
panel background should be removed completely.

## Desktop background widget

Windows does not provide a stable public API for embedding an arbitrary
Electron window below desktop icons. Techniques that re-parent windows into
Explorer’s undocumented `WorkerW` hierarchy can break after Windows updates or
restart Explorer.

The application therefore uses a safe desktop-level mode:

- The widget is removed from the taskbar.
- Always-on-top is disabled.
- Regular application windows naturally cover it.
- Explorer, desktop icons, and the Windows shell are not modified.

The widget may briefly rise in normal window order while it is being moved.
Locking it or enabling click-through prevents accidental focus afterward.

## Click-through recovery

When click-through is enabled, input passes to windows below the widget.
It takes effect after **Save settings**. The Settings button remains interactive
and opens an interactive settings panel; all other widget regions continue to
pass clicks through. Disable click-through from Settings, the tray menu, or
press **Ctrl+Shift+F10**. The shortcut also unlocks and shows the widget, so
settings and Exit always remain accessible.

## Persistence and disconnected monitors

Each display mode remembers its last size and position. At startup, stored
bounds are checked against all connected monitors. If the previous monitor is
missing, the window is safely centered on the primary display.
