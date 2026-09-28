# Build the Chrome extension into dist/ (load-unpacked from that folder).
# Usage: pwsh ./build.ps1   or   .\build.ps1
$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path -LiteralPath 'node_modules')) {
  Write-Host 'node_modules missing; running npm install…'
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

npm run build
exit $LASTEXITCODE
