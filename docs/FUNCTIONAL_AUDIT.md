# Functional audit — Computer Monitor Dashboard 1.1.1

Date: 2026-10-29  
Version: **1.1.1** (not incremented). Nothing was pushed or published.

| Build | Path | FileVersion | Timestamp |
| --- | --- | --- | --- |
| Installed (unchanged) | `C:\Users\mkgam\AppData\Local\Programs\Computer Monitor Dashboard\Computer Monitor Dashboard.exe` | 1.1.1 | 2026-10-29 00:29:20 |
| Verified packaged exe | `artifacts/release/win-unpacked/Computer Monitor Dashboard.exe` | 1.1.1 | 2026-10-29 01:25:49 |
| Installer (not installed) | `artifacts/release/Computer-Monitor-Dashboard-Setup.exe` | — | 2026-10-29 01:26:59 |

Installer size: **161,178,609 bytes** (153.7 MB)  
SHA-256: `DBD8B3862CF12B484C0A2ECA84CBCEED7BD5D57C9B942B49103F5CACBB637223`

The per-user installed copy was **not** replaced. Approval is still required before running the new Setup.exe over it.

## 1. Exact root cause of Appearance not opening

Two cooperating Windows/Electron bugs. Chromium `.click()` and CDP mouse events can succeed while a real user click fails or while the panel is clipped off-screen.

### A. Full dashboard — native hit-testing

The window is `frame: false` and `transparent: true`. `.app` was `-webkit-app-region: drag`. Settings lived **inside** that drag/overflow/`container-type` ancestor. Inactive settings-nav buttons used `background: transparent`.

On Windows, Electron does not deliver native mouse events to fully transparent pixels of a transparent window, and drag regions steal clicks from nested `no-drag` children. The Settings **gear** has an opaque background (`rgb(11 9 32 / .72)`), so it works. **Appearance** (inactive, transparent text button) does not.

`Input.dispatchMouseEvent` on the installed 00:29:20 exe **did** open Appearance on the full dashboard (screenshot `docs/audit-evidence/02-after-appearance-click.png`). OS-level `SendInput` could not be used in this session: `WindowFromPoint` hit `Windows Default Lock Screen` / `LockScreenInputOcclusionFrame` covering the dashboard monitor.

### B. Bar / Mini — settings window stayed 110px tall (why previous fixes “did not take”)

Appearance exists only in `SettingsPanel`. Overlay still also shows the compact OverlaySettings strip. `prepareSettings` requested 780×640, but it called `setMinimumSize(720, 480)` **while Bar’s maximum height was still 110px**. Electron on Windows ignores a min size above the current max, so the window stayed **780×110**. Appearance was in the DOM and clipped. Clicking it did nothing useful.

This was reproduced on the rebuilt unpacked exe **before** the min/max order fix (`ih: 110`, theme radios `[]`). After raising `setMaximumSize` first, Bar settings became **780×640** and Appearance opened with all three theme cards (`docs/audit-evidence/24-bar-appearance-resized.png`).

A 1px HWND realign used to resync `Chrome_RenderWidgetHostHWND` on secondary monitors must not run against the stale 110px bounds, or it writes the clipped size back.

### Fixes in this audit (source; packaged into win-unpacked + Setup.exe)

- Portal `SettingsPanel` to `document.body` so it is not a descendant of `.app` drag/overflow.
- `.app { -webkit-app-region: no-drag }` (titlebar `.topbar` still drags).
- Opaque nav-button and panel backgrounds (`#0d0b25` / theme faces).
- `prepareSettings`: `setMaximumSize` **before** `setMinimumSize`, then `setBounds(780×640)`.
- `realignRendererHitTarget` skips shrinking a settings session below 720×480.
- Vitest: portal + Appearance click regression.

## 2. Other confirmed bugs

| Bug | Status after this audit |
| --- | --- |
| Bar/Mini settings window stuck at 110px, Appearance clipped | **Fixed** in rebuilt package; **not** in the still-installed 00:29:20 exe |
| Transparent Appearance nav buttons in a transparent frameless window | **Fixed** in rebuilt package |
| Settings inside `.app` drag region | **Fixed** in rebuilt package |
| `Chrome_RenderWidgetHostHWND` left on the primary monitor while the window was on a secondary display | **Mitigated** with a 1px bounds nudge after show/move/display change |
| OverlaySettings strip still peeks from the left in Bar settings (Always on Top / Click-Through) beside the portaled panel | **Not redesigned** (visual leftover, Appearance still usable) |
| CPU package temperature | Honest **N/A** on this PC (i7-9700K), not a fake reading |

## 3. Files changed

- `desktop/src/components/SettingsPanel.tsx`
- `desktop/src/styles.css`
- `desktop/src/themes.css`
- `desktop/electron/main.ts`
- `desktop/src/components/TelemetryComponents.test.tsx`
- `docs/FUNCTIONAL_AUDIT.md`
- Evidence PNGs under `docs/audit-evidence/`

## 4. Automated test results

| Suite | Result |
| --- | --- |
| `monitor.tests` (.NET) | **18/18 passed** |
| `desktop` Vitest | **26/26 passed** (includes settings-category navigation, Appearance over Bar, **new portal/Appearance regression**) |

These are not a substitute for the packaged GUI checks below.

## 5–6. Packaged Windows GUI results

**Test methods**

- **Packaged GUI (CDP mouse):** `Input.dispatchMouseEvent` against the unpacked 01:25:49 exe (and, for Appearance-on-full, the installed 00:29:20 exe). This is compositor mouse input, not `HTMLElement.click()`.
- **Automated:** Vitest / .NET.
- **OS SendInput:** attempted; hits the Windows lock-screen occlusion window in this agent session. **NOT TESTED** as a user-hand click.
- The **installed** 00:29:20 exe was **not** re-verified after the Bar min/max rebuild.

| Feature | Test method | Expected | Actual | PASS/FAIL/NOT TESTED | Fix | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Settings → Appearance (full dashboard, installed 00:29:20) | CDP mouse | Category opens | Appearance active; Original RGB / 90s / Coding radios visible | **PASS** | Portal + opaque nav (already in that build’s handler; CDP bypasses native miss) | `02-after-appearance-click.png` |
| Settings → Appearance (full, rebuilt unpacked) | CDP mouse | Category opens | Appearance + 3 radios; backdrop parent is `document.body`; nav `background: rgb(13, 11, 37)` | **PASS** | Portal, opaque buttons, `.app` no-drag | `11-unpacked-appearance.png`, `22-full-appearance-retest.png` |
| Settings → Appearance (Bar, before min/max order fix) | CDP mouse | Panel visible ≥480px tall | Window **780×110**; radios `[]` | **FAIL** | — | part2 log `ih: 110` |
| Settings → Appearance (Bar, after min/max order fix) | CDP mouse | 780×640; Appearance opens | **780×640**; three radios at y=245 h=121; 90s applied | **PASS** | `setMaximumSize` before `setMinimumSize` | `23-bar-settings-resized.png`, `24-bar-appearance-resized.png` |
| Original RGB / 90s / Coding apply | CDP mouse on theme cards | Immediate `data-theme` + localStorage | `nineties` / `coding` / `rgb` each applied | **PASS** | Existing ThemePicker | `theme-nineties.png`, `theme-coding.png`, `theme-rgb.png`, `25-bar-theme-90s.png` |
| Theme after restart | Kill + relaunch unpacked exe | Restored from localStorage | Restart showed **coding** UI (`data-theme=coding`) | **PASS** | `applyStoredTheme` | `27-theme-persist-restart.png` |
| OS-level physical mouse on Appearance | Win32 SendInput | Click reaches Electron | `WindowFromPoint` = Lock Screen / Input Occlusion Window | **NOT TESTED** | — | probe log pid explorer `LockScreenInputOcclusionFrame` |
| Settings categories (General, Display, Gaming Overlay, Network, Appearance, Temperature, About) | CDP mouse | Each pane opens | Each needle string found | **PASS** | aria-pressed nav | audit-results.json |
| Live CPU/GPU/RAM/VRAM/storage | Packaged GUI snapshot | Live or honest N/A | i7-9700K, RTX 2070 33°C, RAM, VRAM, C: and D:; CPU temp **N/A** | **PASS** | Existing sensors | START snapshot; `26-speed-test.png` |
| Downloading / Uploading Mbps | Two samples 2.5s apart | Numeric Mbps or 0.0/N/A | 0.0 then 0.0 idle; later 0.1 / 0.0 live | **PASS** | Existing NetworkCounters | Network card screenshots |
| Test Internet Speed | CDP mouse on button | Progress then Mbps or honest fail | First click missed after Bar→Full layout shift; retry **Testing…** then **94.65 Mbps** | **PASS** (retry) | Existing main-process Cloudflare download | `26-speed-test.png`; speed log |
| Speed test cancel | CDP mouse Cancel while running | Stops test | Cancel button appeared during Testing…; dedicated cancel click not completed (test finished in ~1s) | **NOT TESTED** | — | AFTER_MOUSE showed Cancel |
| Speed test failure path | Forced network failure | Honest Failed | Not injected | **NOT TESTED** | — | — |
| Windowed / Full | CDP / display API | Dashboard chrome | Windowed 1600×1000; Full 1920×1032 | **PASS** | Existing toolbar | audit log |
| BAR / MINI modes | Display API | Compact overlay metrics | BAR 780×110 CPU/GPU/RAM/VRAM/SSD; MINI overlay | **PASS** | Existing overlay | `15-bar` path in log |
| Desktop Background | Display API | `mode=desktop` | First attempt blocked by leftover settingsSession (110px Done clipped); not re-run after resize fix | **NOT TESTED** (after fix) | — | part2 `mode` stayed `bar` |
| Always on Top / Lock / Opacity | Display API | State applied | alwaysOnTop, locked, opacity 0.55 on Mini | **PASS** (API) | Existing overlay | overlayState JSON |
| Click-Through on then recover | Display API | true then false | First recover ran while settingsSession still open | **NOT TESTED** (after fix) | Tray/shortcut still untested by hand | part2 `ctOn: true` leftover |
| OverlaySettings peeking under Bar settings | Screenshot | Settings panel only | Overlay Always on Top / Click-Through visible on the left of 780px window | **FAIL** (cosmetic) | Not redesigned | `23-bar-settings-resized.png` |
| Tray restore / tray menu | Manual tray | Restore window | Not clicked | **NOT TESTED** | — | — |
| Ctrl+Shift+F10 Click-Through shortcut | Keyboard | Toggle | Not pressed | **NOT TESTED** | — | — |
| Multi-monitor move | Place window on second display | Clicks still work | Child HWND was on primary while parent was at x=1920 before nudge | **NOT TESTED** after nudge | `realignRendererHitTarget` | GetWindowRect dump |
| Window drag/resize by hand | Real mouse | Move/resize | Lock screen ate SendInput | **NOT TESTED** | `.topbar` drag | — |
| Start with Windows / tray / minimize-to-tray | Toggle + restart login | Preference applies | Not toggled | **NOT TESTED** | — | — |
| Reset to defaults | Click footer | RGB + defaults | Not clicked | **NOT TESTED** | — | — |
| Exclusive fullscreen games | Overlay above game | Visible | Not tested | **NOT TESTED** | — | — |
| Clean-PC install | Fresh machine | Installer works | Not performed | **NOT TESTED** | — | — |
| Replacing the installed 00:29:20 exe | Setup.exe | User approval | **Not installed** | **NOT TESTED** on installed path | — | installed timestamp unchanged |

## 7. Final installer

`C:\Bahrain Desktop Dashbaord Monitor\artifacts\release\Computer-Monitor-Dashboard-Setup.exe`  
**161,178,609 bytes**, SHA-256 `DBD8B3862CF12B484C0A2ECA84CBCEED7BD5D57C9B942B49103F5CACBB637223`

## 8. Was the installed app verified after rebuilding?

**No.** The rebuilt bits were verified as `artifacts/release/win-unpacked\Computer Monitor Dashboard.exe` (01:25:49). The Start Menu / per-user install is still the 00:29:20 build, which still has the Bar 110px min/max-order bug.

Appearance on the **full** dashboard of that installed build did open under CDP mouse. Appearance on **Bar** of that installed build was not re-clicked after the rebuild because the install was not replaced.

To put the fix on the Start Menu shortcut, install the Setup.exe above (approval required).
