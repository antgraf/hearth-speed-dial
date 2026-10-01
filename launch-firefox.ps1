# Launch Firefox with an isolated profile (.browser-profiles/firefox).
# Usage: pwsh ./launch-firefox.ps1 [-- args...]   or   .\launch-firefox.ps1
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
node (Join-Path $PSScriptRoot 'scripts/launch-firefox.mjs') @args
exit $LASTEXITCODE
