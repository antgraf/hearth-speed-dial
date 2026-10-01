# Pull latest from the current branch remote, then build into dist/ (Chrome)
# or dist-firefox/ when -Target Firefox.
# Usage:
#   .\pull_and_build.ps1
#   .\pull_and_build.ps1 -Target Firefox
#   pwsh ./pull_and_build.ps1 -Target Firefox
param(
  [ValidateSet('Chrome', 'Firefox')]
  [string] $Target = 'Chrome'
)

$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

git pull
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& (Join-Path $PSScriptRoot 'build.ps1') -Target $Target
exit $LASTEXITCODE
