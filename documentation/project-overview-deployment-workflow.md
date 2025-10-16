Great question! **Claude Code doesn't directly deploy** - it helps you write code and deployment commands, but **you** execute the deployment using the Power Platform CLI (PAC CLI). Here's how environment management works:

## Understanding the Deployment Flow

```
Your Code (with Claude Code's help)
    ↓
You run PAC CLI commands manually
    ↓
PAC CLI uses authenticated connection
    ↓
Deploys to the authenticated environment
```

## Step-by-Step: Environment Configuration

### 1. Authenticate to Your Environments

**First, authenticate to each environment you'll use:**

```bash
# Authenticate to DEV environment
pac auth create --url https://yourorg-dev.crm.dynamics.com --name DEV

# Authenticate to TEST environment  
pac auth create --url https://yourorg-test.crm.dynamics.com --name TEST

# Authenticate to PROD environment
pac auth create --url https://yourorg-prod.crm.dynamics.com --name PROD
```

**The `--name` parameter** is a friendly label you assign to each connection.

### 2. List All Your Authenticated Environments

```bash
# See all your authenticated environments
pac auth list
```

**Output will look like:**
```
Index  Name   Environment URL                          User
*1     DEV    https://yourorg-dev.crm.dynamics.com    you@company.com
 2     TEST   https://yourorg-test.crm.dynamics.com   you@company.com
 3     PROD   https://yourorg-prod.crm.dynamics.com   you@company.com

* indicates currently selected profile
```

### 3. Switch Between Environments

```bash
# Select DEV environment for deployment
pac auth select --index 1

# Or by name
pac auth select --name DEV

# Verify which environment is active
pac auth list
```

**The asterisk (*) shows your active environment** - this is where your next deployment will go.

### 4. Deploy to the Active Environment

```bash
# This deploys to whichever environment is currently selected (has the *)
pac pcf push --publisher-prefix xyz
```

**The control deploys to the environment marked with the asterisk.**

## How Claude Code Fits In

### What Claude Code DOES Do:

1. **Helps you write the code** for your PCF control
2. **Helps you write deployment scripts** with environment logic
3. **Helps debug** authentication or deployment issues
4. **Suggests commands** to run

### What Claude Code DOESN'T Do:

❌ Automatically authenticate to environments  
❌ Choose which environment to deploy to  
❌ Execute deployment commands on its own  

**You control deployment** by:
- Running `pac auth select` yourself
- Executing `pac pcf push` yourself  
- Verifying the active environment before deploying

## Best Practices: Environment Management

### Create a Deployment Script

**`deploy-dev.ps1` (PowerShell)**

```powershell
# deploy-dev.ps1
Write-Host "Deploying to DEV environment..." -ForegroundColor Green

# Switch to DEV
pac auth select --name DEV

# Verify we're on DEV
$activeEnv = pac auth list | Select-String -Pattern '\*' -SimpleMatch
Write-Host "Active environment: $activeEnv" -ForegroundColor Yellow

# Confirm before deploying
$confirmation = Read-Host "Deploy to DEV? (y/n)"
if ($confirmation -ne 'y') {
    Write-Host "Deployment cancelled." -ForegroundColor Red
    exit
}

# Build the control
Write-Host "Building control..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Deploy
Write-Host "Deploying to DEV..." -ForegroundColor Cyan
pac pcf push --publisher-prefix xyz

Write-Host "Deployment complete!" -ForegroundColor Green
```

**`deploy-dev.sh` (Bash for Mac/Linux)**

```bash
#!/bin/bash
echo "Deploying to DEV environment..."

# Switch to DEV
pac auth select --name DEV

# Verify we're on DEV
echo "Active environment:"
pac auth list | grep '*'

# Confirm before deploying
read -p "Deploy to DEV? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Build the control
echo "Building control..."
npm run build

if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

# Deploy
echo "Deploying to DEV..."
pac pcf push --publisher-prefix xyz

echo "Deployment complete!"
```

**Then run:**
```bash
# Windows
.\deploy-dev.ps1

# Mac/Linux
chmod +x deploy-dev.sh
./deploy-dev.sh
```

### Add to package.json Scripts

**`package.json`:**

```json
{
  "scripts": {
    "build": "pcf-scripts build",
    "start": "pcf-scripts start",
    "deploy:dev": "pac auth select --name DEV && pac pcf push --publisher-prefix xyz",
    "deploy:test": "pac auth select --name TEST && pac pcf push --publisher-prefix xyz",
    "deploy:prod": "pac auth select --name PROD && pac pcf push --publisher-prefix xyz",
    "pre-deploy": "npm run build && pac auth list"
  }
}
```

**Then run:**
```bash
# Deploy to DEV
npm run deploy:dev

# Deploy to TEST  
npm run deploy:test

# Check environment before deploying
npm run pre-deploy
```

## Environment Safety Checklist

### Before Every Deployment

```bash
# 1. Check which environment is active
pac auth list

# 2. Build your control
npm run build

# 3. Verify build succeeded (check for errors)

# 4. Select target environment
pac auth select --name DEV

# 5. Confirm it's the right environment
pac auth list

# 6. Deploy
pac pcf push --publisher-prefix xyz
```

### Create a Pre-Deployment Verification Script

**`verify-environment.ps1`:**

```powershell
# verify-environment.ps1
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('DEV','TEST','PROD')]
    [string]$ExpectedEnv
)

Write-Host "Verifying environment..." -ForegroundColor Cyan

# Get active environment
$activeEnvLine = pac auth list | Select-String -Pattern '\*' -SimpleMatch
$activeEnv = $activeEnvLine -replace '.*\s(\w+)\s+https.*','$1'

Write-Host "Active environment: $activeEnv" -ForegroundColor Yellow
Write-Host "Expected environment: $ExpectedEnv" -ForegroundColor Yellow

if ($activeEnv -ne $ExpectedEnv) {
    Write-Host "ERROR: Wrong environment!" -ForegroundColor Red
    Write-Host "Active: $activeEnv, Expected: $ExpectedEnv" -ForegroundColor Red
    exit 1
}

Write-Host "Environment verified!" -ForegroundColor Green
```

**Use in deployment:**
```powershell
# Verify before deploying to DEV
.\verify-environment.ps1 -ExpectedEnv DEV
if ($LASTEXITCODE -eq 0) {
    pac pcf push --publisher-prefix xyz
}
```

## Using VS Code Tasks for Deployment

### Create `.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Deploy to DEV",
      "type": "shell",
      "command": "pac auth select --name DEV && pac pcf push --publisher-prefix xyz",
      "group": "build",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "Deploy to TEST",
      "type": "shell",
      "command": "pac auth select --name TEST && pac pcf push --publisher-prefix xyz",
      "group": "build",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "Check Active Environment",
      "type": "shell",
      "command": "pac auth list",
      "group": "test",
      "presentation": {
        "reveal": "always",
        "panel": "shared"
      },
      "problemMatcher": []
    }
  ]
}
```

**Run from VS Code:**
```
1. Ctrl+Shift+P (Cmd+Shift+P on Mac)
2. Type "Run Task"
3. Select "Deploy to DEV" or "Check Active Environment"
```

## Environment Configuration File

### Create `environments.json`

```json
{
  "environments": {
    "dev": {
      "name": "DEV",
      "url": "https://yourorg-dev.crm.dynamics.com",
      "publisherPrefix": "xyz",
      "description": "Development environment"
    },
    "test": {
      "name": "TEST", 
      "url": "https://yourorg-test.crm.dynamics.com",
      "publisherPrefix": "xyz",
      "description": "Testing environment"
    },
    "prod": {
      "name": "PROD",
      "url": "https://yourorg-prod.crm.dynamics.com",
      "publisherPrefix": "xyz",
      "description": "Production environment"
    }
  }
}
```

### Create Deployment Script Using Config

**`deploy.ps1`:**

```powershell
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev','test','prod')]
    [string]$Environment
)

# Load environment configuration
$config = Get-Content -Raw -Path "environments.json" | ConvertFrom-Json
$envConfig = $config.environments.$Environment

Write-Host "Deploying to $($envConfig.description)..." -ForegroundColor Green
Write-Host "URL: $($envConfig.url)" -ForegroundColor Cyan

# Switch environment
pac auth select --name $envConfig.name

# Verify
Write-Host "`nActive environment:" -ForegroundColor Yellow
pac auth list | Select-String -Pattern '\*' -SimpleMatch

# Confirm
$confirmation = Read-Host "`nContinue with deployment? (y/n)"
if ($confirmation -ne 'y') {
    Write-Host "Deployment cancelled." -ForegroundColor Red
    exit
}

# Build and deploy
Write-Host "`nBuilding..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDeploying..." -ForegroundColor Cyan
    pac pcf push --publisher-prefix $envConfig.publisherPrefix
    Write-Host "`nDeployment complete!" -ForegroundColor Green
} else {
    Write-Host "`nBuild failed!" -ForegroundColor Red
}
```

**Usage:**
```powershell
.\deploy.ps1 -Environment dev
.\deploy.ps1 -Environment test
.\deploy.ps1 -Environment prod
```

## How Claude Code Can Help

### Ask Claude Code to Create Deployment Scripts

**Example prompt:**

```
Create a PowerShell deployment script for my PCF control with these requirements:

1. Accept parameter for environment (dev/test/prod)
2. Read environment URLs from environments.json
3. Verify I'm on the correct environment before deploying
4. Build the control (npm run build)
5. Deploy using pac pcf push with publisher prefix "xyz"
6. Show confirmation prompt before deploying
7. Color-coded output (success=green, error=red, info=cyan)
8. Exit with error code if anything fails

Also show me how to add this as an npm script in package.json.
```

### Ask Claude Code to Debug Authentication Issues

**Example prompt:**

```
I'm getting this error when trying to deploy:

```
Error: No profiles found. Use 'pac auth create' to authenticate.
```

My pac auth list shows:
[paste output]

What's wrong and how do I fix it?
```

## Common Authentication Issues

### Issue 1: "No profiles found"

```bash
# Solution: Create authentication
pac auth create --url https://yourorg-dev.crm.dynamics.com --name DEV
```

### Issue 2: "Authentication expired"

```bash
# Solution: Re-authenticate
pac auth select --name DEV
# If prompted, sign in again in the browser
```

### Issue 3: "Wrong environment deployed to"

```bash
# Always check before deploying!
pac auth list

# Look for the asterisk (*)
# If it's on the wrong environment:
pac auth select --name DEV
```

### Issue 4: Multiple users/accounts

```bash
# Clear all authentication and start fresh
pac auth clear

# Re-authenticate to each environment
pac auth create --url https://yourorg-dev.crm.dynamics.com --name DEV
```

## Visual Confirmation in VS Code

### Add Status Bar Extension

Install: **Power Platform Tools** extension for VS Code

Shows current environment in status bar:
```
[Power Platform] DEV | yourorg-dev.crm.dynamics.com
```

## Quick Reference Card

**Print this and keep near your monitor:**

```
╔══════════════════════════════════════════════════════╗
║           PCF DEPLOYMENT QUICK REFERENCE             ║
╠══════════════════════════════════════════════════════╣
║ 1. CHECK ENVIRONMENT                                 ║
║    pac auth list                                     ║
║                                                      ║
║ 2. SWITCH TO DEV                                     ║
║    pac auth select --name DEV                        ║
║                                                      ║
║ 3. BUILD                                             ║
║    npm run build                                     ║
║                                                      ║
║ 4. VERIFY (look for *)                               ║
║    pac auth list                                     ║
║                                                      ║
║ 5. DEPLOY                                            ║
║    pac pcf push --publisher-prefix xyz               ║
║                                                      ║
║ NEVER deploy to PROD without:                        ║
║   ✓ Testing in DEV                                   ║
║   ✓ Testing in TEST                                  ║
║   ✓ Triple-checking pac auth list                    ║
║   ✓ Getting approval                                 ║
╚══════════════════════════════════════════════════════╝
```

## Bottom Line

**Claude Code doesn't know or control where you deploy** - you do!

The workflow is:
1. **You authenticate** to environments with PAC CLI
2. **You select** which environment is active
3. **Claude Code helps you write** the control code and deployment scripts
4. **You execute** the deployment commands
5. **PAC CLI deploys** to the active environment

**Always verify before deploying:**
```bash
pac auth list
```

Look for the asterisk (*) - that's where it's going!