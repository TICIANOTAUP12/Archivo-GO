# Build Windows 7 / 32-bit compatible desktop binary.
# Go 1.22+ and Wails 2.12 binaries do not run on Windows 7.
# This job uses Wails 2.8.1 + Go 1.20 + legacy WebView2 loader.
param(
    [string]$OutputDir = "artifacts"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$goModBackup = Get-Content go.mod -Raw
$goSumBackup = if (Test-Path go.sum) { Get-Content go.sum -Raw } else { $null }

function Set-GoModVersion {
    param([string]$Version)
    $lines = Get-Content go.mod
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^go ') {
            $lines[$i] = "go $Version"
            break
        }
    }
    $lines | Set-Content go.mod
}

try {
    Set-GoModVersion "1.20"

    go1.20.14 get github.com/wailsapp/wails/v2@v2.8.1
    go1.20.14 get github.com/wailsapp/go-webview2@v1.0.10
    go1.20.14 mod tidy

    go1.20.14 install github.com/wailsapp/wails/v2/cmd/wails@v2.8.1
    $wails = Join-Path (go1.20.14 env GOPATH) "bin\wails.exe"
    if (-not (Test-Path $wails)) {
        throw "Wails CLI not found at $wails"
    }

    & $wails build `
        -platform windows/386 `
        -clean `
        -compiler go1.20.14 `
        -webview2 embed `
        -tags native_webview2loader

    $built = Join-Path $repoRoot "build\bin\ArchivoScivoliGNC.exe"
    if (-not (Test-Path $built)) {
        throw "Expected build output not found: $built"
    }

    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    $version = if ($env:GITHUB_REF_NAME) { $env:GITHUB_REF_NAME -replace '^v', '' } else { "local" }
    $exeName = "ArchivoScivoliGNC-$version-windows-386-win7.exe"
    $zipName = "ArchivoScivoliGNC-$version-windows-386-win7.zip"
    Copy-Item $built (Join-Path $OutputDir $exeName) -Force
    Compress-Archive -Path (Join-Path $OutputDir $exeName) -DestinationPath (Join-Path $OutputDir $zipName) -Force
    Write-Host "Built Win7 binary: $(Join-Path $OutputDir $exeName)"
}
finally {
    Set-Content go.mod $goModBackup -NoNewline
    if ($null -ne $goSumBackup) {
        Set-Content go.sum $goSumBackup -NoNewline
    }
}
