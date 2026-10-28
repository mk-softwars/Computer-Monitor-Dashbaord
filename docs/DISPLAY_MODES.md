# Display modes

## Full dashboard

The standard responsive RGB dashboard shows all detected CPU, GPU, memory,
VRAM, and storage readings. Drag empty dashboard chrome or the top header to
move the window. Cards and buttons stay clickable. Widget position locking
does not disable movement of the full dashboard. The close button exits the
app unless Minimize to tray is enabled.

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

The Display Mode settings include a **Panel transparency** slider from 0%
(solid) to 80% (highly see-through). Only the glass panel background fades,
so telemetry labels and values remain crisp. Text-only mode remains available
when the panel background should be removed completely.

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

When click-through is enabled on the floating bar or mini monitor, input
passes to windows below the overlay. It takes effect after **Save settings**.
The Settings button remains interactive. Click-through is never applied to the
full dashboard or desktop widget. Disable it from Settings, the tray menu, or
press **Ctrl+Shift+F10**. The shortcut also unlocks and shows the window.

## Persistence and disconnected monitors

Each display mode remembers its last size and position. At startup, stored
bounds are checked against all connected monitors. If the previous monitor is
missing, the window is safely centered on the primary display.
