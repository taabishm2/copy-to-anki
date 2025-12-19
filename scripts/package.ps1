<#
Package the extension into a versioned zip under ./dist.

How to run (from repo root):
  pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\package.ps1

Optional:
  -KeepStaging   Keep the staging folder in ./dist for inspection.
#>

param(
    [switch]$KeepStaging
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root 'manifest.json'

if (-not (Test-Path $manifestPath))
{
    throw "manifest.json not found at: $manifestPath"
}

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
$version = $manifest.version
if (-not $version)
{
    throw "Could not read 'version' from manifest.json"
}

$distDir = Join-Path $root 'dist'
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

$stagingDir = Join-Path $distDir ("staging-copy-to-anki-v{0}" -f $version)
if (Test-Path $stagingDir)
{
    Remove-Item -Recurse -Force $stagingDir
}
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

function Copy-IfExists
{
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (Test-Path $Path)
    {
        Copy-Item -Force -Recurse $Path $Destination
    }
}

# Publishable payload: core extension files + icons.
Copy-Item -Force $manifestPath $stagingDir

Get-ChildItem -Path $root -File | Where-Object {
    $_.Extension -in @('.js', '.html', '.css')
} | ForEach-Object {
    Copy-Item -Force $_.FullName $stagingDir
}

# Copy only icons referenced by manifest.json (and fall back to all pngs if none declared).
$iconsSrc = Join-Path $root 'icons'
$iconsDst = Join-Path $stagingDir 'icons'
New-Item -ItemType Directory -Path $iconsDst -Force | Out-Null

function Get-ManifestIconRelativePaths
{
    param(
        [Parameter(Mandatory = $true)]$Manifest
    )

    $paths = New-Object System.Collections.Generic.List[string]

    # MV3: action.default_icon can be a string or an object of sizes.
    if ($Manifest.action -and $Manifest.action.default_icon)
    {
        $defaultIcon = $Manifest.action.default_icon
        if ($defaultIcon -is [string])
        {
            $paths.Add($defaultIcon)
        }
        else
        {
            foreach ($prop in $defaultIcon.PSObject.Properties)
            {
                if ($prop.Value -is [string])
                {
                    $paths.Add($prop.Value)
                }
            }
        }
    }

    # Optional top-level icons.
    if ($Manifest.icons)
    {
        foreach ($prop in $Manifest.icons.PSObject.Properties)
        {
            if ($prop.Value -is [string])
            {
                $paths.Add($prop.Value)
            }
        }
    }

    return $paths | Where-Object { $_ } | Select-Object -Unique
}

if (Test-Path $iconsSrc)
{
    $iconPaths = Get-ManifestIconRelativePaths -Manifest $manifest
    $iconPaths = $iconPaths | Where-Object { $_ -like 'icons/*' }

    if ($iconPaths -and $iconPaths.Count -gt 0)
    {
        foreach ($rel in $iconPaths)
        {
            $src = Join-Path $root $rel
            if (-not (Test-Path $src))
            {
                throw "Icon referenced by manifest.json not found: $rel"
            }
            Copy-Item -Force $src $iconsDst
        }
    }
    else
    {
        Get-ChildItem -Path $iconsSrc -File -Filter '*.png' | ForEach-Object {
            Copy-Item -Force $_.FullName $iconsDst
        }
    }
}

# Optional: include LICENSE if present.
Copy-IfExists -Path (Join-Path $root 'LICENSE') -Destination $stagingDir

$zipName = "copy-to-anki-v$version.zip"
$zipPath = Join-Path $distDir $zipName
if (Test-Path $zipPath)
{
    Remove-Item -Force $zipPath
}

Compress-Archive -Path (Join-Path $stagingDir '*') -DestinationPath $zipPath -Force

Write-Host "Created: $zipPath"

if (-not $KeepStaging)
{
    Remove-Item -Recurse -Force $stagingDir
}
