# Third-party notices

Computer Monitor Dashboard includes open-source software. The application is
licensed under the MIT License; third-party components remain under their own
licenses.

## Runtime components

- **LibreHardwareMonitorLib 0.9.4** — Mozilla Public License 2.0  
  Copyright LibreHardwareMonitor contributors.  
  Source: https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/tree/b8077435b898d57539956388cddf49f7dacb86f7  
  License: [`licenses/MPL-2.0.txt`](licenses/MPL-2.0.txt)  
  The application consumes the unmodified NuGet library. Its corresponding
  source is available at the source link above.
- **HIDSharp 2.1.0** — Apache License 2.0  
  Copyright 2010–2025 James F. Bellinger.  
  Source: https://github.com/IntergatedCircuits/HidSharp  
  License: [`licenses/Apache-2.0.txt`](licenses/Apache-2.0.txt)
- **Microsoft .NET runtime and System libraries** — MIT License and included
  third-party notices. Source: https://github.com/dotnet/runtime
- **Electron 33** — MIT License. Source: https://github.com/electron/electron
- **Chromium and bundled Electron components** — various open-source licenses.
  Electron Builder places `LICENSE.electron.txt` and `LICENSES.chromium.html`
  beside the installed executable.
- **React and React DOM 19** — MIT License.  
  Source: https://github.com/facebook/react
- **Lucide React 0.468.0** — ISC License.  
  Source: https://github.com/lucide-icons/lucide

## Build and test tooling

Vite, TypeScript, Vitest, Testing Library, ESLint, Electron Builder, xUnit, and
their transitive dependencies are development tooling and are not shipped as
independent runtime services. Their package metadata and license texts remain
available in their respective npm and NuGet distributions.

This notice is informational and does not replace the license text of any
third-party component.
