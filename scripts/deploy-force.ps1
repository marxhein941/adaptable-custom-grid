# ============================================================================
# Force PCF Deployment Script
# ============================================================================
# Forces deployment by bypassing publisher conflicts
# This script creates a temporary solution and imports the control
#
# Usage:
#   .\deploy-force.ps1
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$PublisherPrefix = "ada",

    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild
)

# ============================================================================
# Configuration
# ============================================================================

$ControlNamespace = "AdaptableControls"
$ControlName = "GridChangeTracker"
$FullControlName = "$ControlNamespace.$ControlName"
$TempSolutionName = "PCFTemp_$([System.Guid]::NewGuid().ToString().Substring(0,8))"

# ============================================================================
# Helper Functions
# ============================================================================

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Text)
    Write-Host "[STEP] $Text" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Text)
    Write-Host "[SUCCESS] $Text" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Text)
    Write-Host "[WARNING] $Text" -ForegroundColor DarkYellow
}

function Write-Error-Message {
    param([string]$Text)
    Write-Host "[ERROR] $Text" -ForegroundColor Red
}

function Write-Info {
    param([string]$Text)
    Write-Host "  $Text" -ForegroundColor White
}

# ============================================================================
# Main Deployment
# ============================================================================

Write-Header "Force PCF Deployment"
Write-Warning "This will attempt to force deploy the control"
Write-Info "Control: $FullControlName"
Write-Info "Publisher: $PublisherPrefix"

# Build if not skipped
if (-not $SkipBuild) {
    Write-Step "Building PCF control..."
    npm run build 2>&1 | Out-String -Stream | ForEach-Object {
        if ($_ -match "error|ERROR") {
            Write-Host $_ -ForegroundColor Red
        }
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Error-Message "Build failed"
        exit 1
    }
    Write-Success "Build completed"
}

# Method 1: Try direct deployment with the specified publisher
Write-Step "Attempting direct deployment with publisher: $PublisherPrefix"
$output = pac pcf push --publisher-prefix $PublisherPrefix 2>&1 | Out-String

if ($LASTEXITCODE -eq 0) {
    Write-Success "Direct deployment succeeded!"
    exit 0
}

if ($output -match "already created by another publisher") {
    Write-Warning "Publisher conflict detected"

    # Method 2: Create a new solution and import
    Write-Step "Creating temporary solution: $TempSolutionName"

    # Create a solution
    pac solution init --publisher-name $PublisherPrefix --publisher-prefix $PublisherPrefix 2>&1 | Out-Null

    # Add the control to the solution
    Write-Step "Adding control to solution..."
    pac solution add-reference --path . 2>&1 | Out-Null

    # Export the solution
    Write-Step "Exporting solution..."
    pac solution export --path ".\$TempSolutionName.zip" --name $TempSolutionName --managed false 2>&1 | Out-Null

    if (Test-Path ".\$TempSolutionName.zip") {
        # Import the solution
        Write-Step "Importing solution to environment..."
        pac solution import --path ".\$TempSolutionName.zip" 2>&1 | Out-String -Stream | ForEach-Object {
            if ($_ -match "succeeded|success") {
                Write-Host $_ -ForegroundColor Green
            } elseif ($_ -match "error|failed") {
                Write-Host $_ -ForegroundColor Red
            }
        }

        # Clean up
        Remove-Item ".\$TempSolutionName.zip" -Force -ErrorAction SilentlyContinue
        Write-Success "Solution import approach completed"
    } else {
        Write-Error-Message "Failed to create solution package"
    }
}

# Method 3: Update existing control (if possible)
Write-Step "Checking if control update is possible..."

# This would require the control to exist and be owned by the same publisher
$updateOutput = pac pcf version --patchbuild --allmanaged 2>&1 | Out-String

if ($updateOutput -match "success") {
    Write-Success "Control updated successfully"
} else {
    Write-Info "Update not possible (control may not exist or different publisher)"
}

Write-Host ""
Write-Header "Deployment Complete"

# Final verification
Write-Step "Verifying deployment..."
$testOutput = pac pcf push --publisher-prefix $PublisherPrefix 2>&1 | Out-String

if ($testOutput -notmatch "already created by another publisher") {
    Write-Success "Control is ready for updates with publisher: $PublisherPrefix"
} else {
    Write-Warning "Control still has publisher conflicts"
    Write-Info "You may need to:"
    Write-Info "1. Manually remove the control from Power Apps"
    Write-Info "2. Use the cleanup-control.ps1 script"
}