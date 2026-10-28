# Security policy

## Reporting a vulnerability

Do not open a public issue containing exploit details, credentials, or personal
system information. Use GitHub’s private vulnerability reporting feature after
the repository is published.

Include the affected version, Windows version, reproduction steps, and the
security impact. Do not include hardware serial numbers or unrelated logs.

## Scope

The desktop application and local monitor service are in scope. The monitor is
designed to bind only to `127.0.0.1` and requires a per-launch random token.
The project does not operate a cloud service or collect telemetry.

Only the latest published version is supported with security fixes.
