# ============================================================================
# Master PCF Deployment Script
# ============================================================================
# Deploys the Grid Change Tracker PCF control to Power Platform environments
# Combines functionality from all previous deployment scripts
#
# Usage:
#   .\deploy.ps1                                    # Deploy to DEV with default publisher
#   .\deploy.ps1 -Environment PP                    # Deploy to Pre-Production
#   .\deploy.ps1 -PublisherPrefix "custom"          # Use custom publisher prefix
#   .\deploy.ps1 -Environment DEV -SkipBuild        # Deploy without rebuilding
#   .\deploy.ps1 -ShowTimestamp                     # Display build timestamp after build
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("DEV", "PP")]
    [string]$Environment = "DEV",

    [Parameter(Mandatory=$false)]
    [string]$PublisherPrefix = "ada",

    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,

    [Parameter(Mandatory=$false)]
    [switch]$ShowTimestamp,

    [Parameter(Mandatory=$false)]
    [switch]$DetailedOutput
)

# ============================================================================
# Configuration
# ============================================================================

$EnvironmentConfig = @{
    DEV = @{
        Name = "PP"  # Auth profile name
        DisplayName = "Development"
        URL = "https://d365-salesandcustomerservice-dev.crm6.dynamics.com"
    }
    PP = @{
        Name = "PP"  # Auth profile name
        DisplayName = "Pre-Production"
        URL = "https://yourorg-pp.crm.dynamics.com"  # Update this URL
    }
}

$Config = $EnvironmentConfig[$Environment]

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
    Write-Host $Text -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Text)
    Write-Host "[SUCCESS] $Text" -ForegroundColor Green
}

function Write-Error-Message {
    param([string]$Text)
    Write-Host "[ERROR] $Text" -ForegroundColor Red
}

function Write-Info {
    param([string]$Text)
    Write-Host "  $Text" -ForegroundColor White
}

function Exit-WithError {
    param([string]$Message, [int]$ExitCode = 1)
    Write-Host ""
    Write-Error-Message "DEPLOYMENT FAILED"
    Write-Error-Message $Message
    Write-Host ""
    exit $ExitCode
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

Write-Header "Grid Change Tracker - Deployment to $($Config.DisplayName)"
Write-Info "Publisher Prefix: $PublisherPrefix"
Write-Info "Build: $(if ($SkipBuild) { 'SKIPPED' } else { 'ENABLED' })"
Write-Host ""

# Check if pac CLI is installed
Write-Step "Checking Power Platform CLI..."
$pacCheck = Get-Command pac -ErrorAction SilentlyContinue
if (-not $pacCheck) {
    Exit-WithError "Power Platform CLI (pac) not found! Install from: https://aka.ms/PowerAppsCLI"
}
Write-Success "Power Platform CLI found (Version: $((pac --version) -replace 'Microsoft PowerPlatform CLI Version: ', ''))"
Write-Host ""

# Check if npm is available
if (-not $SkipBuild) {
    Write-Step "Checking npm..."
    $npmCheck = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npmCheck) {
        Exit-WithError "npm not found! Install Node.js from: https://nodejs.org"
    }
    Write-Success "npm found (Version: $(npm --version))"
    Write-Host ""
}

# ============================================================================
# Environment Selection & Authentication
# ============================================================================

Write-Step "Selecting $($Config.DisplayName) environment..."
pac auth select --name $Config.Name 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Error-Message "Could not select $($Config.DisplayName) environment!"
    Write-Host ""
    Write-Host "Please authenticate first with:" -ForegroundColor Yellow
    Write-Host "  pac auth create --url $($Config.URL) --name $($Config.Name)" -ForegroundColor White
    Write-Host ""
    Write-Host "Or list available auth profiles with:" -ForegroundColor Yellow
    Write-Host "  pac auth list" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Success "$($Config.DisplayName) environment selected"

# Display current auth info
if ($DetailedOutput) {
    Write-Host ""
    Write-Host "Current Authentication:" -ForegroundColor Cyan
    pac auth list | Select-String -Pattern "\*" | ForEach-Object {
        Write-Info $_.Line
    }
}
Write-Host ""

# ============================================================================
# Build
# ============================================================================

if (-not $SkipBuild) {
    Write-Step "Building PCF control..."

    $buildStart = Get-Date

    # Run npm build with output filtering
    if ($DetailedOutput) {
        npm run build
    } else {
        npm run build 2>&1 | Out-String -Stream | ForEach-Object {
            if ($_ -match "error|failed|ERROR|Failed") {
                Write-Host $_ -ForegroundColor Red
            } elseif ($_ -match "warning|Warning") {
                # Suppress ESLint warnings unless verbose
            } elseif ($_ -match "Succeeded|successful|SUCCESS") {
                Write-Host $_ -ForegroundColor Green
            } elseif ($_ -match "^\[" -or $_ -match "Building|Compiling|Generating") {
                Write-Host $_ -ForegroundColor Gray
            }
        }
    }

    if ($LASTEXITCODE -ne 0) {
        Exit-WithError "Build failed! Check the error messages above."
    }

    $buildEnd = Get-Date
    $buildDuration = $buildEnd - $buildStart

    Write-Success "Build completed in $($buildDuration.ToString('mm\:ss'))"

    # Display build timestamp if requested
    if ($ShowTimestamp) {
        $buildConstantsPath = ".\GridChangeTracker\buildConstants.ts"
        if (Test-Path $buildConstantsPath) {
            $buildTimestamp = Get-Content $buildConstantsPath | Select-String "BUILD_TIMESTAMP = '(.+)'" | ForEach-Object { $_.Matches.Groups[1].Value }
            if ($buildTimestamp) {
                Write-Info "Build Timestamp: $buildTimestamp"
            }
        }
    }

    Write-Host ""
} else {
    Write-Info "Skipping build (using existing build output)"
    Write-Host ""
}

# ============================================================================
# Deployment
# ============================================================================

Write-Step "Deploying to $($Config.DisplayName) environment..."
Write-Info "Publisher Prefix: $PublisherPrefix"
Write-Info "Control: AdaptableControls.GridChangeTracker"
Write-Host ""

$deployStart = Get-Date

# Execute deployment
pac pcf push --publisher-prefix $PublisherPrefix 2>&1 | Out-String -Stream | ForEach-Object {
    if ($_ -match "error|Error|ERROR|failed|Failed") {
        Write-Host $_ -ForegroundColor Red
    } elseif ($_ -match "warning|Warning") {
        Write-Host $_ -ForegroundColor Yellow
    } elseif ($_ -match "success|Success|complete|Complete|Succeeded") {
        Write-Host $_ -ForegroundColor Green
    } elseif ($DetailedOutput) {
        Write-Host $_ -ForegroundColor Gray
    }
}

$deploySuccess = $LASTEXITCODE -eq 0
$deployEnd = Get-Date
$deployDuration = $deployEnd - $deployStart

Write-Host ""

# ============================================================================
# Results & Next Steps
# ============================================================================

if ($deploySuccess) {
    Write-Header "DEPLOYMENT SUCCESSFUL!"

    Write-Success "Environment: $($Config.DisplayName)"
    Write-Success "Publisher: $PublisherPrefix"
    Write-Success "Duration: $($deployDuration.ToString('mm\:ss'))"

    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Info "1. Go to https://make.powerapps.com"
    Write-Info "2. Select your $($Config.DisplayName) environment"
    Write-Info "3. Open your model-driven app"
    Write-Info "4. Edit a view and add the GridChangeTracker control:"
    Write-Info "   - Click on the view controls"
    Write-Info "   - Select 'Get more components'"
    Write-Info "   - Find 'GridChangeTracker' (Publisher: $PublisherPrefix)"
    Write-Info "   - Add it to your view"

    Write-Host ""
    Write-Host "Debugging:" -ForegroundColor Cyan
    Write-Info "To enable detailed error logging, add to your Power Apps URL:"
    Write-Info "  &debug=true&flags=FCBDebug=true"
    Write-Info ""
    Write-Info "Look for console messages prefixed with [GridChangeTracker]"

    Write-Host ""
    Write-Header "Deployment Complete"

    exit 0
} else {
    Write-Header "DEPLOYMENT FAILED"

    Write-Host "Common Issues:" -ForegroundColor Yellow
    Write-Host ""

    # Check for common error patterns in the output
    $errorOutput = pac pcf push --publisher-prefix $PublisherPrefix 2>&1 | Out-String

    if ($errorOutput -match "already created by another publisher") {
        Write-Host "⚠ Publisher Conflict Detected" -ForegroundColor Red
        Write-Info "The control was previously deployed with a different publisher prefix."
        Write-Info ""
        Write-Info "Solutions:"
        Write-Info "1. Find the original publisher prefix and use it:"
        Write-Info "   .\deploy.ps1 -PublisherPrefix 'original_prefix'"
        Write-Info ""
        Write-Info "2. Delete the existing control from Power Apps first"
        Write-Info "3. Change the control namespace in ControlManifest.Input.xml"
    }
    elseif ($errorOutput -match "authentication|unauthorized") {
        Write-Host "⚠ Authentication Issue" -ForegroundColor Red
        Write-Info "Re-authenticate to the environment:"
        Write-Info "  pac auth create --url $($Config.URL) --name $($Config.Name)"
    }
    elseif ($errorOutput -match "not found|does not exist") {
        Write-Host "⚠ Environment Not Found" -ForegroundColor Red
        Write-Info "Check available environments:"
        Write-Info "  pac auth list"
    }
    else {
        Write-Host "⚠ Unknown Error" -ForegroundColor Red
        Write-Info "Check the error messages above for details"
    }

    Write-Host ""
    Write-Info "For more help, run with -DetailedOutput flag:"
    Write-Info "  .\deploy.ps1 -Environment $Environment -DetailedOutput"
    Write-Host ""

    exit 1
}
