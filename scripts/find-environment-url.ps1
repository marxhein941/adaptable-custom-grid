# Find Dataverse Environment URL
# This script helps you discover your Dataverse environment URL

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Dataverse Environment URL Finder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "You provided the Power Apps maker URL with environment ID:" -ForegroundColor Yellow
Write-Host "7bb0a84d-b404-edfa-8662-ae4e0c225cc5" -ForegroundColor White
Write-Host ""

Write-Host "Let's find your Dataverse environment URL..." -ForegroundColor Yellow
Write-Host ""

# Check if pac is installed
$pacCheck = Get-Command pac -ErrorAction SilentlyContinue
if (-not $pacCheck) {
    Write-Host "ERROR: Power Platform CLI (pac) not found!" -ForegroundColor Red
    Write-Host "Install from: https://aka.ms/PowerAppsCLI" -ForegroundColor Red
    exit 1
}

Write-Host "Fetching list of available environments..." -ForegroundColor Yellow
Write-Host ""

# Try to authenticate and list environments
Write-Host "Running: pac admin list" -ForegroundColor Gray
Write-Host ""

pac admin list

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Look for an environment URL in the format:" -ForegroundColor Yellow
Write-Host "   https://[orgname].crm[region].dynamics.com" -ForegroundColor White
Write-Host "   Example: https://myorg.crm.dynamics.com" -ForegroundColor White
Write-Host "   Example: https://myorg.crm4.dynamics.com (for EMEA)" -ForegroundColor White
Write-Host ""
Write-Host "2. OR - Get URL from Power Platform Admin Center:" -ForegroundColor Yellow
Write-Host "   a. Go to: https://admin.powerplatform.microsoft.com/" -ForegroundColor White
Write-Host "   b. Click 'Environments'" -ForegroundColor White
Write-Host "   c. Find your environment and click it" -ForegroundColor White
Write-Host "   d. Look for 'Environment URL' in the Details section" -ForegroundColor White
Write-Host ""
Write-Host "3. Once you have the URL, run:" -ForegroundColor Yellow
Write-Host "   pac auth create --url [YOUR-DATAVERSE-URL] --name PP" -ForegroundColor White
Write-Host ""
