# Pull latest from the current branch remote, then build into dist/.
# Usage: pwsh ./pull_and_build.ps1   or   .\pull_and_build.ps1
$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

git pull
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& (Join-Path $PSScriptRoot 'build.ps1')
exit $LASTEXITCODE
