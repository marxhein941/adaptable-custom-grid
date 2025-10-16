# ============================================================================
# Quick Deploy Script - Resolves Publisher Conflicts Automatically
# ============================================================================

param(
    [switch]$SkipBuild
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Quick Deploy with Auto-Resolution" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Build first if not skipped
if (-not $SkipBuild) {
    Write-Host "[STEP] Building control..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "[SUCCESS] Build completed" -ForegroundColor Green
}

# Try common publisher prefixes
$publishers = @("ada", "adapt", "adaptabl", "opal", "custom", "default")

Write-Host ""
Write-Host "[STEP] Trying different publishers to find working one..." -ForegroundColor Yellow

foreach ($pub in $publishers) {
    Write-Host "  Testing: $pub" -ForegroundColor White

    $output = pac pcf push --publisher-prefix $pub 2>&1 | Out-String

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[SUCCESS] Deployment succeeded with publisher: $pub" -ForegroundColor Green
        Write-Host ""
        Write-Host "Future deployments should use:" -ForegroundColor Cyan
        Write-Host "  .\deploy-quick.ps1" -ForegroundColor White
        Write-Host "Or:" -ForegroundColor Cyan
        Write-Host "  pac pcf push --publisher-prefix $pub" -ForegroundColor White
        exit 0
    } elseif ($output -notmatch "already created by another publisher") {
        # Different error, might be a real issue
        if ($output -match "succeeded|success|imported") {
            Write-Host "[SUCCESS] Deployment worked with: $pub" -ForegroundColor Green
            exit 0
        }
    }
}

Write-Host ""
Write-Host "[WARNING] Could not deploy with standard publishers" -ForegroundColor DarkYellow
Write-Host ""
Write-Host "The control exists with a non-standard publisher." -ForegroundColor Yellow
Write-Host ""
Write-Host "OPTIONS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Find the exact publisher manually:" -ForegroundColor Yellow
Write-Host "   - Go to https://make.powerapps.com" -ForegroundColor White
Write-Host "   - Select your environment" -ForegroundColor White
Write-Host "   - Go to Solutions > See all" -ForegroundColor White
Write-Host "   - Look for solutions containing 'GridChangeTracker'" -ForegroundColor White
Write-Host ""
Write-Host "2. Remove the existing control:" -ForegroundColor Yellow
Write-Host "   - Use: .\cleanup-control.ps1" -ForegroundColor White
Write-Host "   - Then run this script again" -ForegroundColor White
Write-Host ""
Write-Host "3. Change the control name in ControlManifest.Input.xml:" -ForegroundColor Yellow
Write-Host "   - Change namespace or constructor to something unique" -ForegroundColor White
Write-Host "   - Example: namespace='OpalControls' instead of 'AdaptableControls'" -ForegroundColor White

exit 1