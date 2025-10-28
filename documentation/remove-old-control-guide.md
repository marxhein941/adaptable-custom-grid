# Guide: Removing Old PCF Control from Development Environment

## Why Remove?
The control was previously deployed with:
- Namespace: `OpalAdaptable` (should be `Adaptable`)
- Publisher: `PowerAppsToolsPublisher_opal` (should be `Adaptable`)
- Method: `pac pcf push` (creates temporary solution)

The new deployment uses proper ISV solution structure that's incompatible with the old deployment.

---

## Step 1: Identify the Old Control Solution

### Method A: Using PAC CLI
```bash
# Authenticate to your dev environment
pac auth create --environment [YOUR_DEV_ENV_URL]

# List all solutions to find the temporary one
pac solution list

# Look for solution names like:
# - PowerAppsToolsTemp_opal
# - PowerAppsToolsTemp_opalcrm
# - Or any solution with the old publisher
```

### Method B: Using Power Platform Admin Center
1. Navigate to https://admin.powerplatform.microsoft.com
2. Select **Environments** → Your Dev Environment
3. Click **Solutions**
4. Look for solutions containing "PowerAppsToolsTemp" or "OpalAdaptable"

---

## Step 2: Check Control Usage

**IMPORTANT:** Before removing, check if any forms are using the control!

### Using PAC CLI:
```bash
# Check dependencies of the solution
pac solution check --solution-name "PowerAppsToolsTemp_opal"
```

### Using Power Platform:
1. Go to https://make.powerapps.com
2. Select your Dev environment
3. Go to **Solutions** → Find the temp solution
4. Click **...** → **See solution layers**
5. Check if any forms reference the control

### Manual Check:
1. Open any forms where you added the control
2. Note which forms use it
3. You'll need to re-add the new control to these forms after deployment

---

## Step 3: Remove Control from Forms

If the control is being used, you must remove it first:

1. Open the form editor for each form using the control
2. Select the control on the form
3. Click **Delete** or **Remove**
4. Click **Save** → **Publish**
5. Repeat for all forms

**Tip:** Take screenshots of the control's configuration (properties) before removing so you can reconfigure the new control identically.

---

## Step 4: Delete the Old Solution

### Method A: Using PAC CLI (Fastest)
```bash
# Delete the temporary solution
pac solution delete --solution-name "PowerAppsToolsTemp_opal"

# If you get an error about dependencies, you may need to delete other related temp solutions
pac solution delete --solution-name "PowerAppsToolsTemp_opalcrm"
```

### Method B: Using Power Platform Admin Center
1. Go to https://admin.powerplatform.microsoft.com
2. Select **Environments** → Your Dev Environment
3. Click **Solutions**
4. Find the temporary solution (e.g., "PowerAppsToolsTemp_opal")
5. Click **...** → **Delete**
6. Confirm deletion

### Method C: Using make.powerapps.com
1. Go to https://make.powerapps.com
2. Select your Dev environment
3. Go to **Solutions**
4. Find the temporary solution
5. Select it and click **Delete**
6. Confirm deletion

---

## Step 5: Clean Up Multiple Temp Solutions

You may have multiple temporary solutions from testing. Check for:
- `PowerAppsToolsTemp_opal`
- `PowerAppsToolsTemp_opalcrm`
- `PowerAppsToolsTemp_dev`
- `PowerAppsToolsTemp_adapt` (from early testing)
- `PowerAppsToolsTemp_ada`
- `PowerAppsToolsTemp_adp`
- etc.

**Script to list all temp solutions:**
```bash
# List all solutions and filter for temp ones
pac solution list | findstr "PowerAppsToolsTemp"
```

Delete each one using:
```bash
pac solution delete --solution-name "[SOLUTION_NAME]"
```

---

## Step 6: Verify Cleanup

```bash
# Verify temp solutions are gone
pac solution list | findstr "PowerAppsToolsTemp"

# Should return nothing

# Verify old publisher is gone (optional)
# The old publisher may remain but won't be used
pac admin list-publishers
```

---

## Step 7: Deploy New Solution

Now you can deploy the new AdaptableSolution:

```bash
# Build the solution first
cd AdaptableSolution
dotnet build

# Navigate back
cd ..

# Authenticate if needed
pac auth create --environment [YOUR_DEV_ENV_URL]

# Import the new solution
pac solution import --path "AdaptableSolution\bin\Debug\AdaptableSolution.zip"
```

---

## Step 8: Re-add Control to Forms

1. Open the form editor for each form that used the old control
2. Add a new control
3. Search for "Adaptable" or "GridChangeTracker"
4. The control should now show as `Adaptable.GridChangeTracker`
5. Configure the control properties (use your screenshots from Step 3)
6. Save and Publish

---

## Troubleshooting

### Error: "Solution cannot be deleted because it has dependencies"
**Cause:** Forms or other components still reference the control

**Fix:**
1. Go back to Step 3 and ensure all forms have the control removed
2. Check for any other components (views, dashboards) using the control
3. Try again

### Error: "Solution not found"
**Cause:** Solution name may be different

**Fix:**
```bash
# List all solutions to find the exact name
pac solution list

# Look for the one with your control
```

### The new control doesn't appear after import
**Cause:** Solution import may still be processing

**Fix:**
1. Wait 2-3 minutes
2. Refresh the browser
3. Check Solutions → AdaptableSolution → Components
4. Verify GridChangeTracker is listed

### Forms still show old control after deletion
**Cause:** Browser cache

**Fix:**
1. Clear browser cache
2. Hard refresh (Ctrl+F5)
3. Close and reopen the form editor

---

## Alternative: Keep Both (Not Recommended)

You could technically keep both controls, but this is **not recommended** because:
- ❌ Confusing to have two controls with similar names
- ❌ Forms won't automatically upgrade
- ❌ Publisher inconsistency
- ❌ Future updates will only apply to new control
- ❌ Twice the maintenance burden

If you must keep both temporarily:
1. Deploy new solution without deleting old
2. Both will appear in control selector
3. Gradually migrate forms from old to new
4. Delete old solution once all forms migrated

---

## Best Practice Workflow

**For DEV environment:**
1. Remove old control (this guide)
2. Deploy new solution
3. Test thoroughly

**For TEST/PROD environments:**
- If you never deployed the old control → Just deploy new solution
- If you deployed old control → Follow this removal guide first

**Going forward:**
- Always use `pac solution import` with AdaptableSolution
- Never use `pac pcf push` for this control anymore
- The proper solution structure is now in place

---

## Summary Checklist

### ✅ Completed (October 28, 2025)
- [x] Identified all temporary solutions (Found: AdaptableDec2024, AdaptableOct, AdaptableTEMP)
- [x] Documented which forms use the control (User verified and noted configurations)
- [x] Took screenshots of control configuration (User completed manually)
- [x] Removed control from all forms (User completed via portal)
- [x] Deleted all temporary solutions (User deleted via Power Platform admin center)
- [x] Verified cleanup (no temp solutions remain) - Confirmed via `pac solution list`
- [x] Built PCF control (`npm run build`) - Completed successfully
- [x] Built new AdaptableSolution (`cd AdaptableSolution && dotnet build`) - Created 424KB package
- [x] Deployed new solution (`pac solution import --path "AdaptableSolution/bin/Debug/AdaptableSolution.zip" --async`) - Deployed in ~47 seconds
- [x] Verified deployment - "Adaptable Custom Grid" (v1.0) visible in solution list
- [x] Re-added control to forms - User completed via form editor
- [x] Tested all functionality - User confirmed successful deployment
- [x] Verified control shows as `Adaptable.GridChangeTracker` - Confirmed working

### 📋 Optional Next Steps
- [ ] Review Solution Checker violations (non-blocking, mostly code quality warnings)
- [ ] Update control version from 0.0.3 to 1.0.0 in ControlManifest.Input.xml
- [ ] Address TypeScript `any` type warnings (from Solution Checker report)
- [ ] Deploy to TEST/PP environment
- [ ] Deploy to PROD environment

---

## Deployment Summary

**Date:** October 28, 2025
**Environment:** D365-SalesAndCustomerService-DEV
**Solution:** AdaptableSolution (Adaptable Custom Grid v1.0)
**Control:** Adaptable.GridChangeTracker
**Publisher:** Adaptable (prefix: adapt)
**Package Size:** 424 KB
**Deployment Time:** ~47 seconds
**Status:** ✅ Successfully deployed and tested

**Key Changes from Old Deployment:**
- Namespace: `OpalAdaptable` → `Adaptable`
- Publisher: `PowerAppsToolsPublisher_opal` → `Adaptable`
- Deployment method: `pac pcf push` → `pac solution import` with proper solution structure
- Solution type: Temporary → Permanent ISV solution

**Deployment Command Used:**
```bash
# Build PCF control
npm run build

# Build solution package
cd AdaptableSolution && dotnet build

# Deploy to environment
pac solution import --path "AdaptableSolution/bin/Debug/AdaptableSolution.zip" --async
```

**Notes:**
- Solution Checker detected violations (likely TypeScript `any` types) - non-blocking for functionality
- All core features tested and working
- Ready for TEST/PROD deployment after optional improvements

---

*Last updated: October 28, 2025 - First successful deployment of AdaptableSolution completed*
