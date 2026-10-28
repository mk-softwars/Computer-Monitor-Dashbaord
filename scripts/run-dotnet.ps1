$ErrorActionPreference = 'Stop'
$local = Join-Path $PSScriptRoot '..\.dotnet\dotnet.exe'
$dotnet = if (Test-Path $local) { $local } else { 'dotnet' }

& $dotnet @args
exit $LASTEXITCODE
