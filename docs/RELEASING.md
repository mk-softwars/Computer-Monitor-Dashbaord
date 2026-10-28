# Releasing Computer Monitor Dashboard

## Prerequisites

- All changes are committed on `main`.
- The Windows build workflow is passing.
- `package.json`, `desktop/package.json`, and
  `monitor/ComputerMonitor.Service.csproj` contain the same version.
- Release notes describe user-visible changes and known sensor limitations.

## Publish a release

1. Update all three version values to the new semantic version.
2. Run:

   ```powershell
   npm run verify:version
   npm test
   npm run build
   ```

3. Install and uninstall the generated installer on a Windows 11 test machine.
4. Commit and push the version update.
5. Create and push a matching tag:

   ```powershell
   git tag v1.0.0
   git push origin main
   git push origin v1.0.0
   ```

The tag triggers `.github/workflows/release.yml`. It validates the tag, runs all
tests, publishes the self-contained monitor, builds the installer, checks the
packaged backend and license notices, and only then creates the GitHub Release.

If any step fails, no release is published. Delete a bad local tag before
reusing it; do not overwrite an existing public release tag. Never retag,
replace, or delete published GitHub Releases such as **v1.0.0**.

## Code signing

Current community builds are unsigned. For trusted public distribution, obtain
an Authenticode code-signing certificate and store it as encrypted GitHub
Actions secrets. Never commit certificate files or passwords. Add signing only
after testing the workflow in a private fork or draft release.
