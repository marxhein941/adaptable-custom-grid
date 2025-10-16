# ============================================================================
# Enhanced PCF Deployment Script with Conflict Resolution
# ============================================================================
# Deploys the Grid Change Tracker PCF control with automatic conflict handling
#
# Features:
#   - Automatic detection of existing controls
#   - Force deployment with solution cleanup
#   - Publisher conflict resolution
#   - Incremental version updates
#   - Retry logic for common failures
#
# Usage:
#   .\deploy-enhanced.ps1                          # Deploy to DEV with auto-detection
#   .\deploy-enhanced.ps1 -Force                   # Force deployment (cleanup existing)
#   .\deploy-enhanced.ps1 -IncrementVersion        # Auto-increment version number
#   .\deploy-enhanced.ps1 -CheckOnly               # Check for conflicts without deploying
#   .\deploy-enhanced.ps1 -CleanupSolutions        # Remove temporary solutions
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("DEV", "PP", "PROD")]
    [string]$Environment = "DEV",

    [Parameter(Mandatory=$false)]
    [string]$PublisherPrefix = "ada",

    [Parameter(Mandatory=$false)]
    [switch]$Force,

    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,

    [Parameter(Mandatory=$false)]
    [switch]$IncrementVersion,

    [Parameter(Mandatory=$false)]
    [switch]$CheckOnly,

    [Parameter(Mandatory=$false)]
    [switch]$CleanupSolutions,

    [Parameter(Mandatory=$false)]
    [switch]$DetailedOutput,

    [Parameter(Mandatory=$false)]
    [switch]$AutoResolve,

    [Parameter(Mandatory=$false)]
    [int]$MaxRetries = 3
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
    PROD = @{
        Name = "PROD"  # Auth profile name
        DisplayName = "Production"
        URL = "https://yourorg.crm.dynamics.com"  # Update this URL
    }
}

$Config = $EnvironmentConfig[$Environment]
$ControlNamespace = "AdaptableControls"
$ControlName = "GridChangeTracker"
$FullControlName = "$ControlNamespace.$ControlName"
$ManifestPath = ".\GridChangeTracker\ControlManifest.Input.xml"

# Solution naming patterns
$SolutionNamePattern = "PowerAppsCDSSolution*"
$TempSolutionPrefix = "PCF_Temp_"

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

function Write-Debug {
    param([string]$Text)
    if ($DetailedOutput) {
        Write-Host "[DEBUG] $Text" -ForegroundColor Gray
    }
}

function Exit-WithError {
    param([string]$Message, [int]$ExitCode = 1)
    Write-Host ""
    Write-Error-Message "OPERATION FAILED"
    Write-Error-Message $Message
    Write-Host ""
    exit $ExitCode
}

# ============================================================================
# Solution Management Functions
# ============================================================================

function Get-ExistingSolutions {
    Write-Debug "Fetching existing solutions..."
    $solutions = pac solution list 2>&1 | Out-String

    if ($solutions -match "No solutions found") {
        return @()
    }

    # Parse solution list
    $solutionList = @()
    $lines = $solutions -split "`n"
    foreach ($line in $lines) {
        if ($line -match "^\s*(\S+)\s+(\S+)\s+(.+)$") {
            $solutionList += @{
                Name = $matches[1]
                Version = $matches[2]
                Publisher = $matches[3]
            }
        }
    }

    return $solutionList
}

function Remove-TempSolutions {
    Write-Step "Cleaning up temporary solutions..."

    $solutions = Get-ExistingSolutions
    $tempSolutions = $solutions | Where-Object { $_.Name -like "$TempSolutionPrefix*" -or $_.Name -like $SolutionNamePattern }

    if ($tempSolutions.Count -eq 0) {
        Write-Info "No temporary solutions found"
        return
    }

    foreach ($solution in $tempSolutions) {
        Write-Info "Removing solution: $($solution.Name)"
        pac solution delete --solution-name $solution.Name --confirm 2>&1 | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Success "Removed: $($solution.Name)"
        } else {
            Write-Warning "Could not remove: $($solution.Name)"
        }
    }
}

function Check-ControlExists {
    Write-Step "Checking for existing control: $FullControlName"

    # First, try a test deployment to see if there's a conflict
    Write-Debug "Attempting test deployment to detect conflicts..."

    # Run a push command and capture the output
    $testOutput = pac pcf push --publisher-prefix "test_detect_$([System.Guid]::NewGuid().ToString().Substring(0,8))" 2>&1 | Out-String

    if ($testOutput -match "already created by another publisher") {
        Write-Warning "Control $FullControlName already exists in the environment"

        # Try to extract publisher from error message
        # The error usually contains the publisher information
        if ($testOutput -match "created by.*publisher") {
            # Try to extract publisher prefix from the error
            $possiblePublisher = $null

            # Pattern 1: Look for "publisher: xxx"
            if ($testOutput -match "publisher:\s*(\w+)") {
                $possiblePublisher = $matches[1]
            }
            # Pattern 2: Look for "by publisher xxx"
            elseif ($testOutput -match "by publisher\s+(\w+)") {
                $possiblePublisher = $matches[1]
            }

            if ($possiblePublisher) {
                Write-Info "Detected existing publisher from error: $possiblePublisher"
                return @{
                    Exists = $true
                    Publisher = $possiblePublisher
                }
            }
        }

        # Alternative: Look for the control in existing solutions
        Write-Debug "Searching solutions for control..."
        $solutions = pac solution list 2>&1 | Out-String

        # Check Adaptable solutions which might contain the control
        $adaptableSolutions = $solutions | Select-String -Pattern "Adaptable|ada" -AllMatches

        if ($adaptableSolutions) {
            Write-Info "Found potential solutions containing the control:"
            foreach ($solution in $adaptableSolutions.Matches) {
                Write-Info "  - $($solution.Value)"
            }

            # Try common publisher prefixes
            $commonPublishers = @("ada", "adaptable", "Adaptable", "opal", "Opal")
            foreach ($pub in $commonPublishers) {
                Write-Debug "Testing publisher prefix: $pub"
                $testDeploy = pac pcf push --publisher-prefix $pub 2>&1 | Out-String

                if ($testDeploy -notmatch "already created by another publisher" -and $testDeploy -notmatch "failed") {
                    Write-Info "Found working publisher: $pub"
                    return @{
                        Exists = $true
                        Publisher = $pub
                    }
                }
            }
        }

        return @{
            Exists = $true
            Publisher = "Unknown"
        }
    }

    Write-Success "Control does not exist - ready for deployment"
    return @{
        Exists = $false
        Publisher = $null
    }
}

function Get-CurrentVersion {
    if (Test-Path $ManifestPath) {
        $manifest = Get-Content $ManifestPath -Raw
        if ($manifest -match 'version="([0-9.]+)"') {
            return $matches[1]
        }
    }
    return "0.0.1"
}

function Increment-Version {
    param([string]$Version)

    $parts = $Version -split '\.'
    if ($parts.Count -eq 3) {
        $major = [int]$parts[0]
        $minor = [int]$parts[1]
        $patch = [int]$parts[2] + 1

        # Roll over patch to minor if needed
        if ($patch -gt 99) {
            $patch = 0
            $minor++
        }

        # Roll over minor to major if needed
        if ($minor -gt 99) {
            $minor = 0
            $major++
        }

        return "$major.$minor.$patch"
    }

    return "0.0.1"
}

function Update-ManifestVersion {
    param([string]$NewVersion)

    Write-Step "Updating manifest version to $NewVersion"

    if (Test-Path $ManifestPath) {
        $content = Get-Content $ManifestPath -Raw
        $content = $content -replace 'version="[0-9.]+"', "version=`"$NewVersion`""
        Set-Content -Path $ManifestPath -Value $content -NoNewline
        Write-Success "Updated manifest version to $NewVersion"
        return $true
    }

    Write-Error-Message "Could not find manifest file"
    return $false
}

# ============================================================================
# Deployment Functions
# ============================================================================

function Deploy-With-Retry {
    param(
        [string]$PublisherPrefix,
        [int]$MaxAttempts = 3
    )

    $attempt = 1
    $deployed = $false

    while ($attempt -le $MaxAttempts -and -not $deployed) {
        Write-Step "Deployment attempt $attempt of $MaxAttempts..."

        # Clear any temporary solutions first
        if ($attempt -gt 1) {
            Remove-TempSolutions
            Start-Sleep -Seconds 2
        }

        # Try deployment
        $output = pac pcf push --publisher-prefix $PublisherPrefix 2>&1 | Out-String

        if ($LASTEXITCODE -eq 0) {
            $deployed = $true
            Write-Success "Deployment succeeded on attempt $attempt"
        } else {
            Write-Warning "Deployment attempt $attempt failed"

            # Analyze error
            if ($output -match "already created by another publisher") {
                Write-Error-Message "Publisher conflict detected"

                if ($AutoResolve) {
                    Write-Info "Attempting auto-resolution..."

                    # Try to extract the existing publisher
                    $controlInfo = Check-ControlExists
                    if ($controlInfo.Publisher -and $controlInfo.Publisher -ne "Unknown") {
                        Write-Info "Retrying with existing publisher: $($controlInfo.Publisher)"
                        $PublisherPrefix = $controlInfo.Publisher
                    } else {
                        Write-Error-Message "Could not determine existing publisher"
                        break
                    }
                } else {
                    Write-Info "Use -AutoResolve to attempt automatic resolution"
                    break
                }
            } elseif ($output -match "Solution import failed") {
                Write-Warning "Solution import issue - will retry"
            } else {
                Write-Error-Message "Unknown deployment error"
                if ($DetailedOutput) {
                    Write-Host $output -ForegroundColor Red
                }
                break
            }
        }

        $attempt++
        if (-not $deployed -and $attempt -le $MaxAttempts) {
            Write-Info "Waiting 5 seconds before retry..."
            Start-Sleep -Seconds 5
        }
    }

    return $deployed
}

function Force-Deploy {
    param([string]$PublisherPrefix)

    Write-Warning "FORCE DEPLOYMENT - This will remove and recreate the control"
    Write-Warning "All existing configurations will be lost!"

    $confirm = Read-Host "Are you sure you want to continue? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Info "Force deployment cancelled"
        return $false
    }

    Write-Step "Removing existing control and solutions..."

    # Clean up all related solutions
    Remove-TempSolutions

    # Try to remove the control using solution delete
    $solutions = pac solution list 2>&1 | Out-String
    $controlSolutions = $solutions | Select-String $ControlName

    foreach ($solution in $controlSolutions) {
        Write-Info "Attempting to remove solution containing control..."
        pac solution delete --solution-name $solution --confirm 2>&1 | Out-Null
    }

    Write-Info "Waiting for cleanup to complete..."
    Start-Sleep -Seconds 10

    # Now attempt deployment
    Write-Step "Attempting fresh deployment..."
    return Deploy-With-Retry -PublisherPrefix $PublisherPrefix -MaxAttempts 1
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

Write-Header "Enhanced Grid Change Tracker Deployment"

# Display configuration
Write-Info "Environment: $($Config.DisplayName)"
Write-Info "Publisher: $PublisherPrefix"
Write-Info "Control: $FullControlName"
Write-Info "Force Mode: $(if ($Force) { 'ENABLED' } else { 'Disabled' })"
Write-Info "Auto-Resolve: $(if ($AutoResolve) { 'ENABLED' } else { 'Disabled' })"
Write-Host ""

# Check pac CLI
Write-Step "Verifying Power Platform CLI..."
$pacCheck = Get-Command pac -ErrorAction SilentlyContinue
if (-not $pacCheck) {
    Exit-WithError "Power Platform CLI not found! Install from: https://aka.ms/PowerAppsCLI"
}
Write-Success "Power Platform CLI ready"

# ============================================================================
# Environment Authentication
# ============================================================================

Write-Step "Authenticating to $($Config.DisplayName)..."
pac auth select --name $Config.Name 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Warning "Could not select environment - attempting to create auth profile..."
    pac auth create --url $Config.URL --name $Config.Name

    if ($LASTEXITCODE -ne 0) {
        Exit-WithError "Authentication failed. Please check your credentials and environment URL."
    }
}
Write-Success "Authenticated to $($Config.DisplayName)"

# ============================================================================
# Cleanup Solutions (if requested)
# ============================================================================

if ($CleanupSolutions) {
    Write-Header "Solution Cleanup"
    Remove-TempSolutions
    Write-Success "Cleanup complete"
    exit 0
}

# ============================================================================
# Check Only Mode
# ============================================================================

if ($CheckOnly) {
    Write-Header "Control Check Results"

    $controlInfo = Check-ControlExists

    if ($controlInfo.Exists) {
        Write-Warning "Control exists with publisher: $($controlInfo.Publisher)"
        Write-Info "To deploy, use one of these options:"
        Write-Info "1. Use the existing publisher: .\deploy-enhanced.ps1 -PublisherPrefix '$($controlInfo.Publisher)'"
        Write-Info "2. Force deployment (removes existing): .\deploy-enhanced.ps1 -Force"
        Write-Info "3. Auto-resolve conflicts: .\deploy-enhanced.ps1 -AutoResolve"
    } else {
        Write-Success "No conflicts detected - ready to deploy"
    }

    $currentVersion = Get-CurrentVersion
    Write-Info "Current version in manifest: $currentVersion"

    exit 0
}

# ============================================================================
# Version Management
# ============================================================================

if ($IncrementVersion) {
    $currentVersion = Get-CurrentVersion
    $newVersion = Increment-Version -Version $currentVersion

    Write-Step "Incrementing version from $currentVersion to $newVersion"

    if (-not (Update-ManifestVersion -NewVersion $newVersion)) {
        Exit-WithError "Failed to update manifest version"
    }
}

# ============================================================================
# Build
# ============================================================================

if (-not $SkipBuild) {
    Write-Step "Building PCF control..."

    npm run build 2>&1 | Out-String -Stream | ForEach-Object {
        if ($_ -match "error|ERROR") {
            Write-Host $_ -ForegroundColor Red
        } elseif ($DetailedOutput) {
            Write-Host $_ -ForegroundColor Gray
        }
    }

    if ($LASTEXITCODE -ne 0) {
        Exit-WithError "Build failed"
    }

    Write-Success "Build completed"
}

# ============================================================================
# Deployment
# ============================================================================

Write-Header "Starting Deployment"

# Check for existing control
$controlInfo = Check-ControlExists

$deploymentSuccess = $false

if ($controlInfo.Exists) {
    Write-Warning "Control already exists"

    if ($Force) {
        $deploymentSuccess = Force-Deploy -PublisherPrefix $PublisherPrefix
    } elseif ($AutoResolve -and $controlInfo.Publisher -ne "Unknown") {
        Write-Info "Using existing publisher: $($controlInfo.Publisher)"
        $deploymentSuccess = Deploy-With-Retry -PublisherPrefix $controlInfo.Publisher -MaxAttempts $MaxRetries
    } else {
        Write-Error-Message "Control exists with publisher: $($controlInfo.Publisher)"
        Write-Info ""
        Write-Info "Options:"
        Write-Info "1. Use existing publisher: -PublisherPrefix '$($controlInfo.Publisher)'"
        Write-Info "2. Force deployment: -Force"
        Write-Info "3. Auto-resolve: -AutoResolve"
        exit 1
    }
} else {
    # Clean deployment
    $deploymentSuccess = Deploy-With-Retry -PublisherPrefix $PublisherPrefix -MaxAttempts $MaxRetries
}

# ============================================================================
# Results
# ============================================================================

if ($deploymentSuccess) {
    Write-Header "DEPLOYMENT SUCCESSFUL!"

    $version = Get-CurrentVersion
    Write-Success "Control: $FullControlName"
    Write-Success "Version: $version"
    Write-Success "Publisher: $PublisherPrefix"
    Write-Success "Environment: $($Config.DisplayName)"

    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Info "1. Go to https://make.powerapps.com"
    Write-Info "2. Select $($Config.DisplayName) environment"
    Write-Info "3. Add the control to your views"

    exit 0
} else {
    Write-Header "DEPLOYMENT FAILED"

    Write-Info "Troubleshooting:"
    Write-Info "1. Check for existing controls: .\deploy-enhanced.ps1 -CheckOnly"
    Write-Info "2. Clean up solutions: .\deploy-enhanced.ps1 -CleanupSolutions"
    Write-Info "3. Force deployment: .\deploy-enhanced.ps1 -Force"
    Write-Info "4. Enable auto-resolve: .\deploy-enhanced.ps1 -AutoResolve"

    exit 1
}