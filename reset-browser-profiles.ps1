# Reset isolated browser profiles under .browser-profiles/.
# Usage: pwsh ./reset-browser-profiles.ps1 [chrome|firefox|all]
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
node (Join-Path $PSScriptRoot 'scripts/reset-browser-profiles.mjs') @args
exit $LASTEXITCODE
