# Old Deployment Scripts (Archived)

These deployment scripts have been replaced by the unified `deploy.ps1` master script in the parent directory.

## Migration Guide

| Old Script | New Command | Notes |
|------------|-------------|-------|
| `deploy-dev.ps1` | `.\deploy.ps1` or `.\deploy.ps1 -Environment DEV` | Default deployment |
| `deploy-pp.ps1` | `.\deploy.ps1 -Environment PP` | Pre-production deployment |
| `deploy-quick.ps1` | `.\deploy.ps1` | No longer needed - build is clean and fast |
| `deploy-fixed.ps1` | `.\deploy.ps1` | No longer needed - ESLint issues resolved |

## Why These Were Replaced

### Consolidation
- Having 4 different deployment scripts was confusing
- Duplicate code across multiple files
- Hard to maintain consistency

### Issues with Old Scripts

1. **deploy-dev.ps1** & **deploy-pp.ps1**
   - Functionally identical except for environment selection
   - Duplicate error handling code
   - Inconsistent output formatting

2. **deploy-quick.ps1**
   - Temporarily patched code files (risky)
   - Git restore operations could fail
   - Not needed - build is now clean

3. **deploy-fixed.ps1**
   - Injected ESLint disable comments (anti-pattern)
   - Modified source files during deployment
   - Fixed the underlying ESLint issues instead

## Benefits of New Master Script

✅ **Single source of truth** - One script to maintain
✅ **Better error handling** - Contextual error messages with solutions
✅ **More flexible** - Multiple parameters for different scenarios
✅ **Cleaner output** - Colored, structured output
✅ **Safer** - No file modification during deployment
✅ **Better documented** - Comprehensive help and examples
✅ **Environment configuration** - Centralized environment settings

## If You Need These Scripts

These scripts are kept for historical reference only. Please use the new `deploy.ps1` master script.

If you have a specific use case that the master script doesn't cover, please:
1. Open an issue documenting the use case
2. Propose an enhancement to the master script
3. DO NOT use these old scripts as they are no longer maintained

## Date Archived

**2025-10-16**

## More Information

See the [DEPLOYMENT.md](../DEPLOYMENT.md) file in the parent directory for complete deployment documentation.
