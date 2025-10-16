# ============================================================================
# PCF Control Cleanup Script
# ============================================================================
# Removes existing PCF controls and their solutions from Power Platform
#
# Usage:
#   .\cleanup-control.ps1                    # Interactive cleanup
#   .\cleanup-control.ps1 -ControlName "GridChangeTracker" -Force
#   .\cleanup-control.ps1 -RemoveAllPCF     # Remove ALL PCF controls
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$ControlName = "GridChangeTracker",

    [Parameter(Mandatory=$false)]
    [string]$Namespace = "AdaptableControls",

    [Parameter(Mandatory=$false)]
    [ValidateSet("DEV", "PP", "PROD")]
    [string]$Environment = "DEV",

    [Parameter(Mandatory=$false)]
    [switch]$Force,

    [Parameter(Mandatory=$false)]
    [switch]$RemoveAllPCF,

    [Parameter(Mandatory=$false)]
    [switch]$ListOnly
)

# ============================================================================
# Configuration
# ============================================================================

$EnvironmentConfig = @{
    DEV = @{
        Name = "PP"
        DisplayName = "Development"
        URL = "https://d365-salesandcustomerservice-dev.crm6.dynamics.com"
    }
    PP = @{
        Name = "PP"
        DisplayName = "Pre-Production"
        URL = "https://yourorg-pp.crm.dynamics.com"
    }
    PROD = @{
        Name = "PROD"
        DisplayName = "Production"
        URL = "https://yourorg.crm.dynamics.com"
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
# Authentication
# ============================================================================

function Ensure-Authentication {
    Write-Step "Authenticating to $($Config.DisplayName)..."

    pac auth select --name $Config.Name 2>&1 | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Write-Error-Message "Not authenticated to $($Config.DisplayName)"
        Write-Info "Please authenticate first:"
        Write-Info "  pac auth create --url $($Config.URL) --name $($Config.Name)"
        exit 1
    }

    Write-Success "Authenticated to $($Config.DisplayName)"
}

# ============================================================================
# Solution Management
# ============================================================================

function Get-PCFSolutions {
    Write-Step "Fetching PCF solutions..."

    $allSolutions = pac solution list 2>&1 | Out-String

    # Common PCF solution patterns
    $pcfPatterns = @(
        "PowerAppsCDSSolution*",
        "PCF_*",
        "*PCFControl*",
        "*$ControlName*"
    )

    $pcfSolutions = @()

    foreach ($pattern in $pcfPatterns) {
        $matches = $allSolutions | Select-String -Pattern $pattern
        foreach ($match in $matches) {
            $line = $match.Line.Trim()
            if ($line -match "^(\S+)\s+(\S+)\s+(.+)$") {
                $solution = @{
                    Name = $matches[1]
                    Version = $matches[2]
                    Publisher = $matches[3]
                    Pattern = $pattern
                }

                # Avoid duplicates
                if ($pcfSolutions.Name -notcontains $solution.Name) {
                    $pcfSolutions += $solution
                }
            }
        }
    }

    return $pcfSolutions
}

function Remove-Solution {
    param([string]$SolutionName)

    Write-Info "Removing solution: $SolutionName"

    $output = pac solution delete --solution-name $SolutionName --confirm 2>&1 | Out-String

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Removed: $SolutionName"
        return $true
    } else {
        Write-Warning "Could not remove: $SolutionName"
        if ($output -match "not found") {
            Write-Info "Solution may have already been removed"
        } else {
            Write-Info "Error: $output"
        }
        return $false
    }
}

function Get-ControlInfo {
    Write-Step "Getting PCF control information..."

    $controls = pac pcf list 2>&1 | Out-String

    if ($controls -match "No PCF controls found") {
        return @()
    }

    $controlList = @()
    $lines = $controls -split "`n"

    foreach ($line in $lines) {
        if ($line -match "(\S+\.\S+)\s+Publisher:\s*(\S+)") {
            $controlList += @{
                FullName = $matches[1]
                Publisher = $matches[2]
            }
        }
    }

    return $controlList
}

# ============================================================================
# Main Cleanup Functions
# ============================================================================

function Cleanup-SpecificControl {
    param(
        [string]$ControlFullName,
        [bool]$ForceRemove = $false
    )

    Write-Header "Cleaning up control: $ControlFullName"

    if (-not $ForceRemove) {
        Write-Warning "This will remove the control and all associated solutions"
        $confirm = Read-Host "Continue? (yes/no)"
        if ($confirm -ne "yes") {
            Write-Info "Cleanup cancelled"
            return
        }
    }

    # Find and remove related solutions
    $solutions = Get-PCFSolutions
    $relatedSolutions = $solutions | Where-Object {
        $_.Name -match $ControlName -or
        $_.Name -match "PowerAppsCDSSolution" -or
        $_.Name -match "PCF_"
    }

    if ($relatedSolutions.Count -eq 0) {
        Write-Info "No related solutions found"
    } else {
        Write-Info "Found $($relatedSolutions.Count) related solution(s)"

        foreach ($solution in $relatedSolutions) {
            Remove-Solution -SolutionName $solution.Name
            Start-Sleep -Seconds 2
        }
    }

    Write-Success "Cleanup complete for $ControlFullName"
}

function Cleanup-AllPCF {
    Write-Header "REMOVING ALL PCF CONTROLS"
    Write-Warning "This will remove ALL PCF controls and solutions!"

    if (-not $Force) {
        $confirm = Read-Host "Are you absolutely sure? Type 'DELETE ALL' to confirm"
        if ($confirm -ne "DELETE ALL") {
            Write-Info "Operation cancelled"
            return
        }
    }

    $solutions = Get-PCFSolutions

    if ($solutions.Count -eq 0) {
        Write-Info "No PCF solutions found"
        return
    }

    Write-Info "Found $($solutions.Count) PCF solution(s) to remove"

    foreach ($solution in $solutions) {
        Remove-Solution -SolutionName $solution.Name
        Start-Sleep -Seconds 2
    }

    Write-Success "All PCF controls and solutions removed"
}

function List-PCFControls {
    Write-Header "PCF Controls and Solutions in $($Config.DisplayName)"

    # List controls
    Write-Step "PCF Controls:"
    $controls = Get-ControlInfo

    if ($controls.Count -eq 0) {
        Write-Info "No PCF controls found"
    } else {
        foreach ($control in $controls) {
            Write-Info "$($control.FullName) (Publisher: $($control.Publisher))"
        }
    }

    Write-Host ""

    # List solutions
    Write-Step "PCF Solutions:"
    $solutions = Get-PCFSolutions

    if ($solutions.Count -eq 0) {
        Write-Info "No PCF solutions found"
    } else {
        foreach ($solution in $solutions) {
            Write-Info "$($solution.Name) v$($solution.Version) (Publisher: $($solution.Publisher))"
        }
    }
}

# ============================================================================
# Main Execution
# ============================================================================

Write-Header "PCF Control Cleanup Utility"

# Ensure we're authenticated
Ensure-Authentication

# Execute based on parameters
if ($ListOnly) {
    List-PCFControls
} elseif ($RemoveAllPCF) {
    Cleanup-AllPCF
} else {
    $fullControlName = "$Namespace.$ControlName"

    # Check if control exists
    $controls = Get-ControlInfo
    $targetControl = $controls | Where-Object { $_.FullName -eq $fullControlName }

    if ($targetControl) {
        Write-Info "Found control: $($targetControl.FullName)"
        Write-Info "Publisher: $($targetControl.Publisher)"
        Cleanup-SpecificControl -ControlFullName $fullControlName -ForceRemove $Force
    } else {
        Write-Warning "Control $fullControlName not found"

        # Check for partial matches
        $partialMatches = $controls | Where-Object { $_.FullName -match $ControlName }
        if ($partialMatches) {
            Write-Info "Found similar controls:"
            foreach ($match in $partialMatches) {
                Write-Info "  - $($match.FullName)"
            }
        }

        # Still offer to clean solutions
        Write-Host ""
        Write-Step "Checking for orphaned solutions..."
        $solutions = Get-PCFSolutions

        if ($solutions.Count -gt 0) {
            Write-Info "Found $($solutions.Count) PCF solution(s)"
            $cleanupSolutions = Read-Host "Clean up these solutions? (yes/no)"

            if ($cleanupSolutions -eq "yes") {
                foreach ($solution in $solutions) {
                    Remove-Solution -SolutionName $solution.Name
                    Start-Sleep -Seconds 2
                }
            }
        }
    }
}

Write-Host ""
Write-Success "Cleanup utility completed"
Write-Host ""