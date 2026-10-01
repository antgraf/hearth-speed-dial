# Pull latest from the current branch remote, then build.
# Default builds all targets (dist/chrome + dist/firefox).
# Usage:
#   .\pull_and_build.ps1
#   .\pull_and_build.ps1 -Target All
#   .\pull_and_build.ps1 -Target Chrome
#   .\pull_and_build.ps1 -Target Firefox
#   pwsh ./pull_and_build.ps1 -Target Firefox
param(
  [ValidateSet('All', 'Chrome', 'Firefox')]
  [string] $Target = 'All'
)

$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

git pull
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& (Join-Path $PSScriptRoot 'build.ps1') -Target $Target
exit $LASTEXITCODE
