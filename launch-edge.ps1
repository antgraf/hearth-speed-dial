# Launch Microsoft Edge with an isolated profile (.browser-profiles/edge).
# Loads the Chrome MV3 build from dist/chrome (no separate Edge dist).
# Usage: pwsh ./launch-edge.ps1 [-- args...]   or   .\launch-edge.ps1
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
node (Join-Path $PSScriptRoot 'scripts/launch-edge.mjs') @args
exit $LASTEXITCODE
