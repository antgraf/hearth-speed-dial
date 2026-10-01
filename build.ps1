# Build the extension into dist/ (Chrome by default) or dist-firefox/.
# Usage:
#   .\build.ps1                 # Chrome → dist/
#   .\build.ps1 -Target Chrome
#   .\build.ps1 -Target Firefox # Chrome build + Firefox manifest tree → dist-firefox/
#   pwsh ./build.ps1 -Target Firefox
param(
  [ValidateSet('Chrome', 'Firefox')]
  [string] $Target = 'Chrome'
)

$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path -LiteralPath 'node_modules')) {
  Write-Host 'node_modules missing; running npm install…'
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Target -eq 'Firefox') {
  npm run build:firefox
  exit $LASTEXITCODE
}

exit 0
