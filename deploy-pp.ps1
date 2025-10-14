# Deploy PCF Control to Pre-Production Environment
# This script builds and deploys the Grid Change Tracker control to PP

param(
    [string]$PublisherPrefix = "abc"  # UPDATE THIS TO YOUR ACTUAL PREFIX
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Grid Change Tracker - PP Deployment" -ForegroundColor Cyan
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

# Select PP environment
Write-Host "Selecting PP environment..." -ForegroundColor Yellow
pac auth select --name PP
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Could not select PP environment!" -ForegroundColor Red
    Write-Host "Please authenticate first with: pac auth create --url https://yourorg-pp.crm.dynamics.com --name PP" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ PP environment selected" -ForegroundColor Green
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

# Deploy to PP
Write-Host "Deploying to PP environment..." -ForegroundColor Yellow
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
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Go to make.powerapps.com" -ForegroundColor White
Write-Host "2. Open your model-driven app" -ForegroundColor White
Write-Host "3. Go to Components > Get more components" -ForegroundColor White
Write-Host "4. Find 'GridChangeTracker' and add to your view" -ForegroundColor White
