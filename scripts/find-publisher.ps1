# ============================================================================
# PCF Publisher Detection Script
# ============================================================================
# Finds the correct publisher prefix for the GridChangeTracker control
#
# Usage:
#   .\find-publisher.ps1
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [switch]$DetailedOutput
)

# ============================================================================
# Configuration
# ============================================================================

$ControlNamespace = "AdaptableControls"
$ControlName = "GridChangeTracker"
$FullControlName = "$ControlNamespace.$ControlName"

# Common publisher prefixes to try
$PublisherPrefixes = @(
    "ada",
    "adaptable",
    "Adaptable",
    "AdaptableControls",
    "adaptablecontrols",
    "opal",
    "Opal",
    "custom",
    "default"
)

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

function Write-Info {
    param([string]$Text)
    Write-Host "  $Text" -ForegroundColor White
}

# ============================================================================
# Main Logic
# ============================================================================

Write-Header "Publisher Detection for $FullControlName"

Write-Step "Testing different publisher prefixes..."

$foundPublisher = $null

foreach ($publisher in $PublisherPrefixes) {
    Write-Info "Testing publisher: $publisher"

    # Try to deploy with this publisher
    $output = pac pcf push --publisher-prefix $publisher 2>&1 | Out-String

    if ($DetailedOutput) {
        Write-Host $output -ForegroundColor Gray
    }

    # Check if it succeeded or gave a different error
    if ($output -match "already created by another publisher") {
        Write-Warning "Not the correct publisher: $publisher"
    } elseif ($output -match "Import Solution Succeeded" -or $output -match "Solution imported successfully") {
        Write-Success "FOUND WORKING PUBLISHER: $publisher"
        $foundPublisher = $publisher
        break
    } elseif ($output -notmatch "failed|error|Error|Failed") {
        # Might be working, but need to verify
        Write-Info "Possible match: $publisher (needs verification)"
        $foundPublisher = $publisher
    }
}

Write-Host ""

if ($foundPublisher) {
    Write-Header "Publisher Found!"
    Write-Success "The correct publisher prefix is: $foundPublisher"
    Write-Host ""
    Write-Host "Use this command to deploy:" -ForegroundColor Cyan
    Write-Info ".\deploy-enhanced.ps1 -PublisherPrefix '$foundPublisher'"
    Write-Host ""
} else {
    Write-Warning "Could not determine the publisher automatically"
    Write-Host ""
    Write-Host "Try these approaches:" -ForegroundColor Yellow
    Write-Info "1. Force deployment (removes existing):"
    Write-Info "   .\deploy-enhanced.ps1 -Force"
    Write-Info ""
    Write-Info "2. Check the error message for the actual publisher:"
    Write-Info "   Run: pac pcf push --publisher-prefix test"
    Write-Info "   Look for the publisher name in the error message"
    Write-Host ""
}

# Also check for any PowerAppsCDS solutions
Write-Step "Checking for PowerAppsCDS solutions..."
$solutions = pac solution list 2>&1 | Out-String

$pcfSolutions = $solutions | Select-String -Pattern "PowerAppsCDS|PCF_|$ControlName" -AllMatches

if ($pcfSolutions) {
    Write-Info "Found related solutions:"
    foreach ($solution in $pcfSolutions.Matches) {
        Write-Info "  - $($solution.Value)"
    }
}