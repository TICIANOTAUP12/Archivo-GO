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

    Push-Location frontend
    npm ci
    npm run build
    Pop-Location

    $version = if ($env:GITHUB_REF_NAME) { $env:GITHUB_REF_NAME -replace '^v', '' } else { "local" }
    $ldflags = "-X main.appVersion=$version -X main.releaseChannel=windows-386-win7"

    & $wails build `
        -platform windows/386 `
        -clean `
        -compiler go1.20.14 `
        -webview2 error `
        -tags native_webview2loader `
        -ldflags $ldflags

    $built = Join-Path $repoRoot "build\bin\ArchivoScivoliGNC.exe"
    if (-not (Test-Path $built)) {
        throw "Expected build output not found: $built"
    }

    $bundleDir = Join-Path $repoRoot "build\win7-bundle"
    if (Test-Path $bundleDir) {
        Remove-Item $bundleDir -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $bundleDir | Out-Null

    $version = if ($env:GITHUB_REF_NAME) { $env:GITHUB_REF_NAME -replace '^v', '' } else { "local" }
    $exeName = "ArchivoScivoliGNC-$version-windows-386-win7.exe"
    Copy-Item $built (Join-Path $bundleDir $exeName) -Force

    $webviewCabUrl = "https://github.com/westinyang/WebView2RuntimeArchive/releases/download/109.0.1518.78/Microsoft.WebView2.FixedVersionRuntime.109.0.1518.78.x86.cab"
    $cabPath = Join-Path $env:TEMP "Microsoft.WebView2.FixedVersionRuntime.109.0.1518.78.x86.cab"
    Write-Host "Downloading WebView2 109 x86 runtime..."
    curl.exe -L --retry 3 --retry-delay 5 -o $cabPath $webviewCabUrl
    if ((Get-Item $cabPath).Length -lt 100MB) {
        throw "WebView2 cab download looks incomplete: $cabPath"
    }

    $webviewExtractRoot = Join-Path $env:TEMP "webview2-extract"
    if (Test-Path $webviewExtractRoot) {
        Remove-Item $webviewExtractRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $webviewExtractRoot | Out-Null
    Write-Host "Extracting WebView2 runtime..."
    expand.exe $cabPath -F:* $webviewExtractRoot | Out-Null

    $runtimeExe = Get-ChildItem $webviewExtractRoot -Recurse -Filter "msedgewebview2.exe" | Select-Object -First 1
    if (-not $runtimeExe) {
        throw "WebView2 runtime extraction failed: msedgewebview2.exe not found"
    }

    $webviewDir = Join-Path $bundleDir "webview2"
    Copy-Item $runtimeExe.Directory.FullName (Join-Path $bundleDir "webview2") -Recurse -Force

    Copy-Item (Join-Path $repoRoot "docs\WIN7-INSTALACION.md") (Join-Path $bundleDir "LEEME-WIN7.txt") -Force
    Copy-Item (Join-Path $repoRoot "docs\manual-de-uso.html") (Join-Path $bundleDir "manual-de-uso.html") -Force

    $dataDir = Join-Path $bundleDir "data"
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    Set-Content (Join-Path $dataDir ".gitkeep") "" -Encoding ascii

    $tesseractSource = Join-Path $repoRoot "third_party\tesseract-win32"
    $tesseractTarget = Join-Path $bundleDir "tesseract"
    if (Test-Path (Join-Path $tesseractSource "tesseract.exe")) {
        Copy-Item $tesseractSource $tesseractTarget -Recurse -Force
        Write-Host "Bundled Tesseract x86 from third_party/tesseract-win32"
    } else {
        New-Item -ItemType Directory -Force -Path (Join-Path $tesseractTarget "tessdata") | Out-Null
        @(
            "Colocá tesseract.exe y tessdata/spa.traineddata aquí para OCR local."
            "Ver docs/WIN7-INSTALACION.md"
        ) | Set-Content (Join-Path $tesseractTarget "LEEME-OCR.txt") -Encoding UTF8
        Write-Host "Tesseract not found in third_party/tesseract-win32 — added LEEME-OCR.txt placeholder"
    }

    $popplerSource = Join-Path $repoRoot "third_party\poppler-win32"
    $popplerTarget = Join-Path $bundleDir "poppler"
    if (Test-Path (Join-Path $popplerSource "pdftoppm.exe")) {
        Copy-Item $popplerSource $popplerTarget -Recurse -Force
        Write-Host "Bundled Poppler x86 from third_party/poppler-win32"
    } else {
        New-Item -ItemType Directory -Force -Path $popplerTarget | Out-Null
        @(
            "Colocá pdftoppm.exe y DLLs de Poppler aquí para OCR de PDF escaneado."
            "Descarga: https://github.com/oschwartz10612/poppler-windows/releases (win32)"
            "Ver docs/WIN7-INSTALACION.md"
        ) | Set-Content (Join-Path $popplerTarget "LEEME-POPPLER.txt") -Encoding UTF8
        Write-Host "Poppler not found in third_party/poppler-win32 — added LEEME-POPPLER.txt placeholder"
    }

    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    $zipName = "ArchivoScivoliGNC-$version-windows-386-win7.zip"
    if (Test-Path (Join-Path $OutputDir $zipName)) {
        Remove-Item (Join-Path $OutputDir $zipName) -Force
    }
    Compress-Archive -Path (Join-Path $bundleDir "*") -DestinationPath (Join-Path $OutputDir $zipName)
    Copy-Item (Join-Path $bundleDir $exeName) (Join-Path $OutputDir $exeName) -Force
    Write-Host "Built Win7 bundle: $(Join-Path $OutputDir $zipName)"
}
finally {
    Set-Content go.mod $goModBackup -NoNewline
    if ($null -ne $goSumBackup) {
        Set-Content go.sum $goSumBackup -NoNewline
    }
}
