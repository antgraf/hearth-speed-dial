# Launch Chrome with an isolated profile (.browser-profiles/chrome).
# Usage: pwsh ./launch-chrome.ps1 [-- args...]   or   .\launch-chrome.ps1
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
node (Join-Path $PSScriptRoot 'scripts/launch-chrome.mjs') @args
exit $LASTEXITCODE
