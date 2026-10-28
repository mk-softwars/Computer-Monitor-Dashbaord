$ErrorActionPreference = 'Stop'

$root = Get-Content (Join-Path $PSScriptRoot '..\package.json') -Raw | ConvertFrom-Json
$desktop = Get-Content (Join-Path $PSScriptRoot '..\desktop\package.json') -Raw | ConvertFrom-Json
[xml]$project = Get-Content (Join-Path $PSScriptRoot '..\monitor\ComputerMonitor.Service.csproj') -Raw
$serviceVersion = $project.Project.PropertyGroup.Version

$versions = @($root.version, $desktop.version, $serviceVersion) | Select-Object -Unique
if ($versions.Count -ne 1) {
    throw "Version mismatch: root=$($root.version), desktop=$($desktop.version), service=$serviceVersion"
}

if ($env:RELEASE_TAG) {
    if ($env:RELEASE_TAG -notmatch '^v\d+\.\d+\.\d+$') {
        throw "Release tag '$env:RELEASE_TAG' must use the format v1.2.3."
    }
    $tagVersion = $env:RELEASE_TAG.Substring(1)
    if ($tagVersion -ne $root.version) {
        throw "Release tag $env:RELEASE_TAG does not match application version $($root.version)."
    }
}

Write-Host "Version $($root.version) is consistent."
