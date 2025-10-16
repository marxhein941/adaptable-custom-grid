# Grid Change Tracker PCF - Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Grid Change Tracker PCF control to Power Platform environments, with special focus on handling common deployment issues and conflicts.

## Quick Start

### First-Time Deployment
```powershell
# Standard deployment to DEV environment
.\deploy-enhanced.ps1

# Deploy with auto-conflict resolution
.\deploy-enhanced.ps1 -AutoResolve
```

### Resolving Publisher Conflicts
```powershell
# Check for existing conflicts
.\deploy-enhanced.ps1 -CheckOnly

# Auto-resolve conflicts and deploy
.\deploy-enhanced.ps1 -AutoResolve

# Force deployment (removes existing control)
.\deploy-enhanced.ps1 -Force
```

## Deployment Scripts

### 1. deploy-enhanced.ps1
The primary deployment script with advanced conflict resolution capabilities.

#### Key Features:
- Automatic detection of existing controls
- Publisher conflict resolution
- Retry logic for transient failures
- Solution cleanup capabilities
- Version management

#### Common Usage Scenarios:

**Standard Deployment:**
```powershell
.\deploy-enhanced.ps1
```

**When Publisher Conflicts Occur:**
```powershell
# Option 1: Auto-resolve (recommended)
.\deploy-enhanced.ps1 -AutoResolve

# Option 2: Force deployment (removes existing)
.\deploy-enhanced.ps1 -Force

# Option 3: Use specific publisher
.\deploy-enhanced.ps1 -PublisherPrefix "existing_publisher"
```

**Development Workflow:**
```powershell
# Skip build if already built
.\deploy-enhanced.ps1 -SkipBuild

# Auto-increment version number
.\deploy-enhanced.ps1 -IncrementVersion

# Detailed output for debugging
.\deploy-enhanced.ps1 -DetailedOutput
```

#### Parameters:

| Parameter | Description | Default |
|-----------|-------------|---------|
| -Environment | Target environment (DEV, PP, PROD) | DEV |
| -PublisherPrefix | Publisher prefix for the control | ada |
| -Force | Force deployment, removing existing control | false |
| -SkipBuild | Skip the build step | false |
| -IncrementVersion | Auto-increment version in manifest | false |
| -CheckOnly | Check for conflicts without deploying | false |
| -CleanupSolutions | Remove temporary solutions | false |
| -AutoResolve | Automatically resolve publisher conflicts | false |
| -MaxRetries | Maximum deployment retry attempts | 3 |
| -DetailedOutput | Show detailed output | false |

### 2. cleanup-control.ps1
Utility script for removing PCF controls and cleaning up solutions.

#### Usage Examples:

**List all PCF controls and solutions:**
```powershell
.\cleanup-control.ps1 -ListOnly
```

**Remove specific control:**
```powershell
.\cleanup-control.ps1 -ControlName "GridChangeTracker"
```

**Force removal without confirmation:**
```powershell
.\cleanup-control.ps1 -ControlName "GridChangeTracker" -Force
```

**Remove ALL PCF controls (use with caution):**
```powershell
.\cleanup-control.ps1 -RemoveAllPCF
```

### 3. deploy.ps1 (Original)
The original deployment script - still functional but recommend using deploy-enhanced.ps1 for better error handling.

## Handling Common Issues

### Issue 1: Publisher Conflict Error

**Error Message:**
```
CustomControl with name AdaptableControls.GridChangeTracker failed to import with error:
Custom Control with name AdaptableControls.GridChangeTracker already created by another publisher
```

**Solutions:**

1. **Use Auto-Resolve (Recommended):**
   ```powershell
   .\deploy-enhanced.ps1 -AutoResolve
   ```
   This will automatically detect the existing publisher and use it for deployment.

2. **Check and Use Existing Publisher:**
   ```powershell
   # First, check what publisher owns the control
   .\deploy-enhanced.ps1 -CheckOnly

   # Then use the reported publisher
   .\deploy-enhanced.ps1 -PublisherPrefix "existing_publisher"
   ```

3. **Force Deployment (Destructive):**
   ```powershell
   # This removes the existing control first
   .\deploy-enhanced.ps1 -Force
   ```

4. **Manual Cleanup:**
   ```powershell
   # Remove the control
   .\cleanup-control.ps1 -ControlName "GridChangeTracker"

   # Then deploy fresh
   .\deploy-enhanced.ps1
   ```

### Issue 2: Solution Import Failures

**Solutions:**

1. **Clean up temporary solutions:**
   ```powershell
   .\deploy-enhanced.ps1 -CleanupSolutions
   ```

2. **Use retry mechanism:**
   ```powershell
   .\deploy-enhanced.ps1 -MaxRetries 5
   ```

### Issue 3: Authentication Issues

**Solutions:**

1. **Create new authentication profile:**
   ```powershell
   pac auth create --url https://yourorg.crm.dynamics.com --name DEV
   ```

2. **List existing profiles:**
   ```powershell
   pac auth list
   ```

3. **Select specific profile:**
   ```powershell
   pac auth select --name DEV
   ```

## Recommended Deployment Process

### For Development Environment

1. **Initial Setup:**
   ```powershell
   # Authenticate to environment
   pac auth create --url https://d365-salesandcustomerservice-dev.crm6.dynamics.com --name PP
   ```

2. **First Deployment:**
   ```powershell
   # Deploy with auto-resolve enabled
   .\deploy-enhanced.ps1 -AutoResolve
   ```

3. **Subsequent Deployments:**
   ```powershell
   # Quick deployment (skip build if no changes)
   .\deploy-enhanced.ps1 -SkipBuild -AutoResolve

   # Or with version increment
   .\deploy-enhanced.ps1 -IncrementVersion -AutoResolve
   ```

### For Production Environment

1. **Pre-deployment Check:**
   ```powershell
   .\deploy-enhanced.ps1 -Environment PROD -CheckOnly
   ```

2. **Deployment:**
   ```powershell
   .\deploy-enhanced.ps1 -Environment PROD -IncrementVersion
   ```

## Continuous Deployment Best Practices

### 1. Version Management
- Always increment version for production deployments
- Use semantic versioning (major.minor.patch)
- Document changes for each version

### 2. Environment-Specific Configuration
- Maintain separate publisher prefixes per environment if needed
- Use consistent naming conventions
- Document environment-specific URLs

### 3. Error Recovery
- Always use `-AutoResolve` for development deployments
- Keep `-Force` as last resort
- Run cleanup scripts periodically to remove orphaned solutions

### 4. Monitoring Deployment
```powershell
# Enable detailed output for troubleshooting
.\deploy-enhanced.ps1 -DetailedOutput

# Check deployment status
.\deploy-enhanced.ps1 -CheckOnly
```

## Troubleshooting Checklist

1. **Pre-Deployment:**
   - [ ] Authenticated to correct environment
   - [ ] Check for existing controls: `.\deploy-enhanced.ps1 -CheckOnly`
   - [ ] Clean up old solutions if needed: `.\cleanup-control.ps1 -ListOnly`

2. **During Deployment:**
   - [ ] Use `-AutoResolve` flag
   - [ ] Enable `-DetailedOutput` for debugging
   - [ ] Set appropriate `-MaxRetries` value

3. **Post-Deployment:**
   - [ ] Verify control appears in Power Apps
   - [ ] Test control functionality
   - [ ] Document any issues encountered

## Environment Configuration

Update environment URLs in the scripts:

```powershell
$EnvironmentConfig = @{
    DEV = @{
        Name = "PP"
        DisplayName = "Development"
        URL = "https://d365-salesandcustomerservice-dev.crm6.dynamics.com"
    }
    PP = @{
        Name = "PP"
        DisplayName = "Pre-Production"
        URL = "https://yourorg-pp.crm.dynamics.com"  # UPDATE THIS
    }
    PROD = @{
        Name = "PROD"
        DisplayName = "Production"
        URL = "https://yourorg.crm.dynamics.com"  # UPDATE THIS
    }
}
```

## Support and Issues

If deployment issues persist:

1. Run cleanup: `.\cleanup-control.ps1 -Force`
2. Clear Power Platform cache
3. Try deployment with different publisher prefix
4. Check Power Platform service health
5. Review detailed logs: `.\deploy-enhanced.ps1 -DetailedOutput`

## Quick Reference Card

```powershell
# Most Common Commands

# Deploy with conflict resolution
.\deploy-enhanced.ps1 -AutoResolve

# Check for conflicts
.\deploy-enhanced.ps1 -CheckOnly

# Force deployment (removes existing)
.\deploy-enhanced.ps1 -Force

# Clean up solutions
.\cleanup-control.ps1

# List all PCF controls
.\cleanup-control.ps1 -ListOnly

# Deploy to specific environment
.\deploy-enhanced.ps1 -Environment PP -AutoResolve

# Deploy with version increment
.\deploy-enhanced.ps1 -IncrementVersion -AutoResolve
```

---

Last Updated: 2025-01-16
Version: 1.0