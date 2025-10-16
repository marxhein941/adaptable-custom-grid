# Development Build Script - Bypasses ESLint errors for rapid development
# This allows building despite TypeScript 'any' type warnings

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Development Build (ESLint Bypass Mode)" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Update build timestamp
Write-Host "Updating build timestamp..." -ForegroundColor Yellow
node scripts/update-build-timestamp.js

# Build using msbuild directly to bypass npm build's ESLint
Write-Host "Building PCF control (bypassing ESLint)..." -ForegroundColor Yellow

# Use msbuild if available, otherwise use dotnet build
$msbuildPath = "${env:ProgramFiles}\Microsoft Visual Studio\2022\*\MSBuild\Current\Bin\MSBuild.exe"
$msbuildExe = Get-ChildItem $msbuildPath -ErrorAction SilentlyContinue | Select-Object -First 1

if ($msbuildExe) {
    Write-Host "Using MSBuild..." -ForegroundColor Cyan
    & $msbuildExe.FullName /t:build /restore /p:Configuration=Debug
} else {
    Write-Host "Using dotnet build..." -ForegroundColor Cyan
    dotnet build --configuration Debug
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Build Successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Output location: .\out\controls" -ForegroundColor Yellow
    Write-Host "Ready for deployment with pac pcf push" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Build failed. Check output above for errors." -ForegroundColor Red
    exit 1
}