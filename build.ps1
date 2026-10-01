# Build extension packages under dist/.
# Usage:
#   .\build.ps1                    # Chrome + Firefox (default)
#   .\build.ps1 -Target All
#   .\build.ps1 -Target Chrome     # dist/chrome only
#   .\build.ps1 -Target Firefox    # Vite Chrome tree + Firefox manifest → dist/firefox
#   pwsh ./build.ps1 -Target Firefox
param(
  [ValidateSet('All', 'Chrome', 'Firefox')]
  [string] $Target = 'All'
)

$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path -LiteralPath 'node_modules')) {
  Write-Host 'node_modules missing; running npm install…'
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

switch ($Target) {
  'Chrome' {
    npm run build:chrome
    exit $LASTEXITCODE
  }
  'Firefox' {
    # Firefox packaging copies from the Chrome tree, then rewrites the manifest.
    npm run build:chrome
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build:firefox
    exit $LASTEXITCODE
  }
  Default {
    npm run build
    exit $LASTEXITCODE
  }
}
