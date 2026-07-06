$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = "1"
py -m pytest gateway/tests/ -q -p pytest_asyncio.plugin
