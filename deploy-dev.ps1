# Deploy PCF Control to Development Environment
# This script builds and deploys the Grid Change Tracker control to DEV
# Publisher: Adaptable | Prefix: ada

param(
    [string]$PublisherPrefix = "ada"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Grid Change Tracker - DEV Deployment" -ForegroundColor Cyan
Write-Host "Publisher: Adaptable | Prefix: ada" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if pac CLI is installed
Write-Host "Checking Power Platform CLI..." -ForegroundColor Yellow
$pacCheck = Get-Command pac -ErrorAction SilentlyContinue
if (-not $pacCheck) {
    Write-Host "ERROR: Power Platform CLI (pac) not found!" -ForegroundColor Red
    Write-Host "Install from: https://aka.ms/PowerAppsCLI" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Power Platform CLI found" -ForegroundColor Green
Write-Host ""

# Select DEV environment
Write-Host "Selecting DEV environment..." -ForegroundColor Yellow
pac auth select --name DEV
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Could not select DEV environment!" -ForegroundColor Red
    Write-Host "Please authenticate first with: pac auth create --url https://yourorg-dev.crm.dynamics.com --name DEV" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ DEV environment selected" -ForegroundColor Green
Write-Host ""

# Build the control
Write-Host "Building control..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Build successful" -ForegroundColor Green
Write-Host ""

# Deploy to DEV
Write-Host "Deploying to DEV environment..." -ForegroundColor Yellow
pac pcf push --publisher-prefix $PublisherPrefix
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Deployment successful" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
