# Smart functional audit — Computer Monitor Dashboard 1.1.1

Date: 2026-10-29  
Auditor: autonomous Windows/Electron GUI session  
Version: **1.1.1** (not incremented). Nothing was pushed or published.

## 0. How to read this report

| Label | Meaning |
| --- | --- |
| **PASS** | The behavior was exercised and matched the expected result. |
| **FAIL** | The behavior was exercised and did not match. |
| **NOT TESTED** | No qualifying evidence in this session. |

Test methods are named explicitly. Chromium `Input.dispatchMouseEvent` is compositor mouse input against a packaged Electron window. It is **not** an OS-level `SendInput` click and can succeed on transparent pixels or `-webkit-app-region: drag` targets that a real Windows click would miss.

Playwright Electron is not in this repository. GUI work used CDP against `--remote-debugging-port`.

## 1. Architecture inventory

| Layer | Location | Role |
| --- | --- | --- |
| Electron main | `desktop/electron/main.ts` | Frameless transparent `BrowserWindow`, tray, display modes, click-through, speed test, window-state.json |
| Preload | `desktop/electron/preload.ts` | `window.computerMonitor` IPC bridge |
| Renderer | `desktop/src/` React 19 + Vite 8 | Dashboard, overlay, settings portal, themes |
| Sensor service | `monitor/` .NET 8 | LibreHardwareMonitor + `GetIPStatistics`, localhost WebSocket |
| Persistence | `%APPDATA%\computer-monitor-dashboard-desktop\window-state.json` + renderer `localStorage` `computer-monitor-settings` |
| Packaging | electron-builder NSIS x64, `app.computermonitor.dashboard` | Per-user Start Menu install |

### User-facing feature inventory

1. Live CPU name, load gauge, package temperature (honest N/A when missing)
2. Live GPU name, load, temperature, hotspot, VRAM
3. RAM used + RAM temperature when present
4. Storage capacity + drive temperature when present
5. Network Downloading / Uploading Mbps from local interface counters
6. Optional Test Internet Speed (Cloudflare download in main process)
7. Windowed / Full / Bar / Mini / Desktop Background
8. Settings: General, Display, Gaming Overlay, Network, Appearance, Temperature, About
9. Themes: Original RGB (default), 90s, Coding
10. Always on Top, Overlay Opacity, Click-Through, Lock Position, Reset Overlay Position
11. System tray, Start with Windows, Minimize to tray
12. Click-Through shortcut (Ctrl+Shift+F10 / configurable)
13. Window minimize / maximize / close / drag
14. Ctrl+, opens settings

## 2. Builds compared

| Build | Path | FileVersion | Timestamp | SHA-256 |
| --- | --- | --- | --- | --- |
| **Installed Start Menu exe** | `C:\Users\mkgam\AppData\Local\Programs\Computer Monitor Dashboard\Computer Monitor Dashboard.exe` | 1.1.1 | 2026-10-29 00:29:20 | `A083531C0546CD2AFA48D6DA64057AF4305D9A5FF7AE13C14BAA9DB3F495115F` |
| Installed `app.asar` | `...\Computer Monitor Dashboard\resources\app.asar` | — | 2026-10-29 00:29:20 | `885D299CA5269F431221E5A521FAB6DC6A5958C93FF0AC5D7E217BE8DDE08653` |
| **Verified rebuilt exe** | `artifacts/release-audit/win-unpacked\Computer Monitor Dashboard.exe` | 1.1.1 | 2026-10-29 02:27:50 | `57EEA84C3EC210216DF800030981E9F79B585E963B14570043F1300280D23DF9` |
| Rebuilt installer (not installed) | `artifacts/release-audit/Computer-Monitor-Dashboard-Setup.exe` | 1.1.1 | 2026-10-29 02:28:50 | `88D9B54B22C846BBE1B3C717934F7E2FA6F516E7710F535D179503348BDEAC16` |

The Start Menu shortcut still launches the **00:29:20** install. That `app.asar` is **not** the rebuilt frontend. This audit did **not** replace the installed copy.

Shortcuts: Start Menu `.lnk` exists. Desktop shortcut does not.

## 3. Installed Appearance (priority)

### What the installed 00:29:20 bundle actually contains

Extracted `index-BCbICx7L.js` / `index-Sv60bCaA.css` / `dist-electron/main.js`:

- Strings **Appearance**, **Original RGB**, **Coding**, **Test Internet Speed** are present.
- `.app { -webkit-app-region: drag }`
- `.settings-nav button { background: 0 0 }` (fully transparent)
- Settings backdrop parent was **`document.body` = false** (not portaled)
- `nativeClickThroughShouldIgnore` still returns true for `mode === 'desktop'`
- Appearance nav computed style during the live click: `background: rgba(0, 0, 0, 0)`

On a `transparent: true` frameless window, Windows native hit-testing ignores fully transparent pixels, and drag regions steal clicks from nested `no-drag` children. CDP mouse can still hit those pixels.

### Installed GUI results (CDP mouse on the real 00:29:20 exe)

Evidence: `docs/audit-evidence/smart/installed-appearance-results.json` and PNGs in the same folder.

| Feature | Method | Expected | Actual | Status |
| --- | --- | --- | --- | --- |
| Installed exe launches | Packaged GUI CDP | Dashboard | CPU card + 1600×1000 | **PASS** |
| Settings opens | CDP mouse Open settings | Panel visible | open, but `portal=false`, `appRegion=drag` | **PASS** (panel) / native-hit **RISK** |
| Appearance present | Computed style | Opaque hittable button | 150×32, `rgba(0,0,0,0)` | Present, **transparent** |
| Appearance category | CDP mouse Appearance | RGB / 90s / Coding | All three radios + copy | **PASS (CDP)** |
| Theme 90s / Coding / RGB | CDP mouse cards | Immediate + localStorage | Each applied and saved | **PASS (CDP)** |
| Done after themes | CDP mouse Done | Settings closes | Closed | **PASS (CDP)** |
| BAR mode | CDP mouse Bar | Compact overlay | 750×85 live metrics | **PASS** |
| BAR settings / Appearance | CDP mouse | ≥480px + 3 radios | 780×640, 3 radios | **PASS (CDP)** |
| OS-level physical mouse on Appearance | Win32 SendInput | Click reaches Electron | Not run (prior session hit lock-screen occlusion) | **NOT TESTED** |

**Appearance status on the installed Start Menu app:** CDP can open Appearance. That is **not** proof a real Windows click works. The installed CSS still uses a transparent Appearance button inside a drag region, which is the same class of defect users reported. **Do not treat the installed Start Menu build as Appearance-fixed.**

### Rebuilt package Appearance

| Feature | Method | Expected | Actual | Status |
| --- | --- | --- | --- | --- |
| Settings portal / opaque nav | CDP + computed style | Portaled to `document.body`, nav `rgb(13,11,37)`, `.app` `no-drag` | Exactly that | **PASS** |
| Appearance opens | CDP mouse | Three theme radios | Original RGB / 90s / Coding | **PASS** |
| Themes apply + save | CDP mouse | Immediate `data-theme` + localStorage | nineties / coding / rgb | **PASS** |
| Done after theme change | CDP mouse Done | Settings closes | Closed, theme kept | **PASS** |
| Appearance over BAR | CDP mouse | 3 radios, no stacked overlay strip | 780×640, radios=3, `.overlay-settings` absent | **PASS** |
| Theme after restart | Kill + relaunch unpacked exe | Restore from localStorage | Restart showed `coding` then restored to RGB | **PASS** |

Evidence: `unpacked-appearance.png`, `unpacked-bar-settings.png`, `unpacked-theme-persist-restart.png`, `persist-check.json`.

**Appearance status on the rebuilt unpackaged exe: PASS for CDP mouse.** OS-level hand click remains **NOT TESTED**.

## 4. Automated suites

| Suite | Result |
| --- | --- |
| `monitor.tests` (.NET) | **18/18 passed** |
| `desktop` Vitest | **30/30 passed** (includes new CSS regression: `.app` no-drag + opaque `.settings-nav button`) |

These do not replace packaged GUI checks.

## 5. Packaged GUI results (rebuilt `release-audit` exe)

Process path confirmed: `artifacts\release-audit\win-unpacked\Computer Monitor Dashboard.exe`.

### Hardware and network

| Feature | Method | Expected | Actual | Status |
| --- | --- | --- | --- | --- |
| Startup empty state | Screenshot `unpacked-start.png` | Honest N/A while sensors start | STARTING; Detecting processor; N/A gauges | **PASS** (honest empty) |
| Live CPU/GPU/RAM/VRAM/storage | Live CDP re-probe after sensors connected | Live or honest N/A | i7-9700K 60–72% load; RTX 2070 26–44% / 29°C; RAM 44%; VRAM 10–16%; C: 75% and D: 39% | **PASS** |
| CPU package temperature | Live GUI | Honest N/A on this i7-9700K | **N/A / UNAVAILABLE / LIMITED** | **PASS** (not fabricated) |
| Downloading / Uploading | Live DOM `.network-speeds` | Mbps or 0.0/N/A | `DOWNLOADING 0.1/0.0 Mbps`, `UPLOADING 0.0 Mbps`; later 32 / 0.2 Mbps during speed test | **PASS** |
| First scripted parse of hardware | Regex on `innerText` | Live class + Mbps | Failed (label case / layout); sensors were live on re-probe | First row **FAIL (harness)**; product **PASS** on re-probe |
| Test Internet Speed | CDP mouse + wait ≤22s | Mbps or honest fail | **94.52 Mbps**; monitoring still updating | **PASS** |
| Speed test cancel | CDP mouse Cancel while running | Stops test | Test finished before a dedicated cancel click | **NOT TESTED** |
| Speed test offline/timeout | Forced network failure | Honest Failed | Not injected | **NOT TESTED** |
| Duplicate speed tests | Second click while running | Ignored (`speedTestAbort` guard) | Code inspection only | **NOT TESTED** (GUI) |

### Window modes

| Feature | Method | Expected | Actual | Status |
| --- | --- | --- | --- | --- |
| Full | CDP mouse Full | Maximized dashboard | 1920×1032, not overlay | **PASS** |
| Windowed | CDP mouse Windowed | Restored dashboard | 1600×1000 | **PASS** |
| Desktop Background | CDP mouse Desktop | Full dashboard, still clickable | `app--desktop`, then Windowed click recovered | **PASS** |
| BAR | CDP mouse Bar | Compact overlay | 750×85 | **PASS** |
| MINI | CDP mouse Mini | Compact overlay | 750×85 | **PASS** |
| BAR settings window | CDP mouse | ≥480px Monitor settings only | 780×640, no `.overlay-settings` | **PASS** |
| Multi-monitor list | `listDisplays()` | ≥1 display | 3 displays (two HP 25mx, one HP 25x) | **PASS** (API) |
| Move window to second display by hand | Real mouse | Clicks still work | Not moved by hand | **NOT TESTED** |
| Overlay resize remembered after restart | Restart in Mini | Saved bounds | Mini bounds exist in window-state; dedicated Mini restart not isolated | **NOT TESTED** |

### Settings and chrome

| Feature | Method | Expected | Actual | Status |
| --- | --- | --- | --- | --- |
| General / Display / Gaming Overlay / Network / Appearance / Temperature / About | CDP mouse each nav | Category copy visible | Each needle found | **PASS** |
| Always on Top / Click-Through / Opacity / Lock / Reset Position | Visible in Gaming Overlay | Controls present | Present (values not each toggled end-to-end this run) | Controls **PASS** (presence); Click-Through enable **NOT TESTED** this run |
| Tray restore / tray menu | Manual tray | Restore / disable click-through | Not clicked | **NOT TESTED** |
| Ctrl+Shift+F10 | OS global shortcut | Toggle click-through | Not pressed | **NOT TESTED** |
| Ctrl+, | Renderer keydown | Opens settings | Code path present; not pressed this run | **NOT TESTED** |
| Close / minimize / restore | Window controls | Expected chrome | Close used via API to restart; minimize not clicked | Close **PASS**; minimize **NOT TESTED** |
| Start with Windows | Toggle + reboot | Login item | Not toggled | **NOT TESTED** |

## 6. Realistic workflows

| Scenario | Result | Status |
| --- | --- | --- |
| Open app → Settings → Appearance → change theme → Done | RGB→90s→Coding→RGB; Done closed settings | **PASS** (CDP, rebuilt exe) |
| BAR → settings → Appearance | 780×640, three themes, no leftover overlay strip | **PASS** |
| BAR → Always on Top → Click-Through → tray recover | Not executed (would require tray) | **NOT TESTED** |
| MINI → resize → restart → saved position | Not isolated | **NOT TESTED** |
| Speed test while hardware continues | 94.52 Mbps; gauges/live clock still updating in the result screenshot | **PASS** |
| Disconnect/reconnect monitor service | Not killed independently this run; startup N/A then live is the cold-start equivalent | Partial: startup recovery **PASS**; mid-session kill **NOT TESTED** |
| Several settings → restart → persistence | Theme coding survived process restart; RGB restored afterward | Theme **PASS**; other settings not all round-tripped |
| Switch all display modes | Full, Windowed, Desktop (recoverable), Bar, Mini | **PASS** |
| Open/close app repeatedly | Closed via API, relaunched, sensors returned | **PASS** (2 cycles) |
| Network unavailable | Not forced | **NOT TESTED** |
| Missing sensors | CPU package temp N/A; not fabricated | **PASS** |

## 7. Reliability and performance

| Observation | Evidence |
| --- | --- |
| Working set after live use | ~183 MB, later ~104 MB after restart |
| CPU time | ~9 s over the first GUI pass (~2 min wall); ~1.1 s shortly after restart |
| Sensor cadence | ~1 s (`refreshIntervalMs` default); live clock advanced |
| Speed test | Completed in-session; 94.52 Mbps; UI stayed interactive enough to keep LIVE MONITORING |
| Unhandled renderer exceptions | None captured on the installed launch snapshot |
| `app.asar` lock | `artifacts/release/win-unpacked` was EBUSY during rebuild; packaged instead to `artifacts/release-audit` |

No additional performance rewrite was justified from these samples.

## 8. Bugs discovered

| ID | Bug | Where | Root cause | Fix | Retest |
| --- | --- | --- | --- | --- | --- |
| B1 | Start Menu exe is not the rebuilt app | Installed 00:29:20 vs rebuilt 02:27:50 | Different `app.asar` hashes | Not installed (approval required) | Confirmed different SHA |
| B2 | Appearance native click can miss on installed exe | Installed CSS/main | Transparent nav + `.app` drag + settings not portaled | Already in rebuilt source (portal, `#0d0b25` nav, `.app` no-drag) | CDP PASS on rebuilt; OS mouse still NOT TESTED |
| B3 | Desktop mode ate all clicks | Installed main + leftover `window-state` | `nativeClickThroughShouldIgnore` always true for desktop | Rebuilt: desktop no longer ignores mouse; only Bar/Mini click-through does | Desktop → Windowed **PASS** |
| B4 | Bar → Full left Always on Top stuck | `window-state.json` `alwaysOnTop: true` in full | Overlay auto-pin not cleared when returning to full | `applyDisplayState` now clears alwaysOnTop when leaving overlay/desktop to full | Code + Vitest; not a dedicated GUI assert |
| B5 | Two settings UIs stacked on Bar | OverlaySettings + SettingsPanel | Compact strip still rendered under the portaled panel | OverlaySettings removed; Gaming Overlay lives in SettingsPanel | BAR settings screenshot: no Always on Top strip |
| B6 | Theme change killed Done / felt frozen | Prior session | Native window chrome IPC + ungated passthrough | CSS-only theme; skip native IPC on theme-only saves | Done after theme **PASS** |
| B7 | First hardware regex in this audit reported FAIL | Audit harness | `innerText` is `DOWNLOADING\\n0.1 Mbps`, not `Downloading 0.1 Mbps` | Re-probed live DOM | Product **PASS** |

## 9. Fixes implemented this session

- `desktop/electron/main.ts`: do not click-through the full/desktop dashboard; clear Always on Top when leaving Bar/Mini/Desktop for Full.
- `desktop/src/App.tsx`: pointer passthrough only for Bar/Mini click-through; skip native window IPC when only theme/thresholds changed.
- `desktop/src/components/OverlayBar.tsx`: stop stacking a second overlay settings strip.
- `desktop/src/themes.css` / `SettingsPanel.tsx`: opaque Coding chrome; 90s contain/paint jank reduced; Desktop help text.
- `desktop/src/theme.test.ts` + `TelemetryComponents.test.tsx`: Appearance drag/opaque CSS regression; no stacked overlay settings.

Vitest: **30/30**. Rebuilt into `artifacts/release-audit\`.

## 10. Remaining limitations

- The **installed** Start Menu application is still 00:29:20.
- OS-level physical mouse on Appearance: **NOT TESTED**.
- Tray, global click-through shortcut, minimize-to-tray, Start with Windows, exclusive-fullscreen games, forced offline speed test, and a dedicated Mini position-restart test: **NOT TESTED**.
- `docs/DISPLAY_MODES.md` still describes Desktop as always passing mouse clicks. Rebuilt behavior keeps Desktop clickable so the window is recoverable without the tray.
- `artifacts/release/win-unpacked` could not be overwritten (EBUSY). Use `artifacts/release-audit`.

## 11. Release readiness

**Not ready for public release** until:

1. Mohammed approves installing `artifacts/release-audit/Computer-Monitor-Dashboard-Setup.exe` over the 00:29:20 Start Menu copy.
2. Appearance is confirmed with a real mouse click on that installed exe (not only CDP).
3. Click-Through recovery is confirmed from the tray or Ctrl+Shift+F10.

The rebuilt unpackaged exe is the best current candidate. The Start Menu exe is not that build.

## 12. Concise summary

1. **Features exercised:** 26 scripted GUI cases on the rebuilt exe + 11 on the installed exe + 48 automated tests + live re-probes (hardware, displays, theme restart).
2. **Passed:** .NET 18/18; Vitest 30/30; installed CDP Appearance/themes/Bar 11/11; rebuilt GUI 23/26 in the first script, with the 3 fails being harness/API-await issues that **re-probed PASS**; speed test 94.52 Mbps; theme persist PASS.
3. **Failures discovered:** installed vs rebuilt mismatch (B1); installed native-hit Appearance risk (B2); leftover Always on Top (B4); first-pass hardware regex FAIL (harness).
4. **Bugs fixed in source this session:** B3, B4, B5 (plus earlier theme/Done/90s work already in the rebuilt tree).
5. **Not tested and why:** OS SendInput (lock-screen occlusion in this agent environment); tray/global shortcut/minimize-to-tray/login item (need real shell interaction); speed-test cancel (test finished first); forced offline; exclusive fullscreen games.
6. **Appearance:** rebuilt exe **PASS (CDP)** including persistence. Installed 00:29:20 **PASS (CDP) but NOT native-hit verified** and still ships transparent drag-region CSS. Treat installed Appearance as **unfixed for a real Windows click**.
7. **Packaged Windows app:** rebuilt `release-audit` exe verified by process path. Installed exe is a different SHA and was **not** replaced.
8. **Public release:** **No.** Install the rebuilt Setup.exe only after approval, then re-check Appearance with a physical click.
