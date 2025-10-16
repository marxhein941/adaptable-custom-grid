# 🚀 READY TO DEPLOY!

Your PCF Grid Change Tracker control is fully configured and ready for deployment.

## ✅ Configuration Complete

**Environment:** D365 Sales and Customer Service (DEV)
**URL:** https://d365-salesandcustomerservice-dev.crm6.dynamics.com
**Region:** APAC (crm6)
**Publisher:** Adaptable
**Prefix:** ada
**Environment ID:** 7bb0a84d-b404-edfa-8662-ae4e0c225cc5

## 🎯 Deploy Now - 3 Simple Steps

### Step 1: Authenticate (One Time Only)

Open PowerShell in this directory and run:

```powershell
pac auth create --url https://d365-salesandcustomerservice-dev.crm6.dynamics.com --name PP
```

**What happens:**
- A browser window will open
- Log in with your Microsoft credentials
- Authentication is stored securely on your computer
- You only need to do this once

### Step 2: Deploy the Control

```powershell
.\deploy-pp.ps1
```

**What the script does:**
1. ✓ Checks if pac CLI is installed
2. ✓ Selects your authenticated environment
3. ✓ Builds the control (`npm run build`)
4. ✓ Deploys with publisher prefix 'ada'
5. ✓ Shows success message with next steps

**Expected output:**
```
========================================
Grid Change Tracker - PP Deployment
Publisher: Adaptable | Prefix: ada
========================================

✓ Power Platform CLI found
✓ PP environment selected
✓ Build successful
✓ Deployment successful

Deployment Complete!
```

### Step 3: Add Control to Your Model-Driven App

1. Go to: https://make.powerapps.com/
2. Open your **model-driven app** in the designer
3. Select a view/form where you want the editable grid
4. Click **"Components"** → **"Get more components"**
5. Find **"GridChangeTracker"** (by Adaptable)
6. Click **"Add"**
7. Configure properties:
   - **Enable Change Tracking:** Yes
   - **Changed Cell Background Color:** `#FFF4CE` (or your preference)
   - **Aggregation Mode:** Sum / Average / Count / None
   - **Show Change Asterisk:** Yes
8. **Save** and **Publish** your app

## 🎨 Control Features

Once deployed, the control provides:

✅ **Editable Grid**
- Full Fluent UI DetailsList integration
- Inline cell editing
- Professional Power Apps styling

✅ **Change Tracking**
- Visual indicators with background color
- Optional asterisk (*) for changed cells
- Compares current vs original values
- Track multiple cell changes

✅ **Aggregations**
- Sum, Average, or Count
- Displayed in footer row
- Auto-calculates for numeric columns
- Configurable per deployment

✅ **Bulk Save**
- Save all changes at once
- Parallel WebAPI updates
- Loading states and error handling
- Success/failure notifications

## 🔧 Alternative: Manual Deployment

If you prefer to run commands manually:

```powershell
# Select environment
pac auth select --name PP

# Build
npm run build

# Deploy
pac pcf push --publisher-prefix ada
```

## 📊 After Deployment

The control will be available as:
- **Control Name:** GridChangeTracker
- **Namespace:** AdaptableControls
- **Full Name:** ada_AdaptableControls.GridChangeTracker
- **Publisher:** Adaptable

## ❓ Troubleshooting

**"No profiles found"**
```powershell
# Run authentication first
pac auth create --url https://d365-salesandcustomerservice-dev.crm6.dynamics.com --name PP
```

**"Build failed"**
```powershell
# Reinstall dependencies
npm install
npm run build
```

**"Deployment failed"**
- Verify you have System Administrator or System Customizer role
- Check that you're authenticated: `pac auth list`
- Ensure your profile is selected: `pac auth select --name PP`

**Control doesn't appear in "Get more components"**
- Wait 5-10 minutes after deployment
- Clear browser cache (Ctrl + F5)
- Verify deployment succeeded

**Changes not showing after update**
- Increment version in `GridChangeTracker/ControlManifest.Input.xml`
- Rebuild and redeploy
- Clear browser cache
- Republish your app

## 🔄 Update Control Later

When you make code changes:

1. **Increment version** in `ControlManifest.Input.xml`:
   ```xml
   <control version="0.0.3" ...>
   ```

2. **Build and deploy:**
   ```powershell
   npm run build
   pac auth select --name PP
   pac pcf push --publisher-prefix ada
   ```

3. **Refresh browser** in your app (Ctrl + F5)

## 🎓 Configuration Properties

When adding to your app, configure these properties:

| Property | Type | Recommended | Description |
|----------|------|-------------|-------------|
| Enable Change Tracking | Yes/No | **Yes** | Show visual indicators for changes |
| Changed Cell Background Color | Text | **#FFF4CE** | Highlight color for modified cells |
| Aggregation Mode | Enum | **Sum** or None | Footer calculation type |
| Show Change Asterisk | Yes/No | **Yes** | Display * for changed cells |

## 📱 Test the Control

After adding to your app:

1. Open a record with the grid control
2. Edit a cell value
3. ✓ Cell should show background color
4. ✓ Asterisk (*) should appear if enabled
5. ✓ "1 change" counter should appear in header
6. ✓ Click "Save Changes" button
7. ✓ Success message should appear
8. ✓ Background color should clear

## 🌐 Environment URLs (For Reference)

| Environment | URL |
|-------------|-----|
| **DEV/PP (Current)** | https://d365-salesandcustomerservice-dev.crm6.dynamics.com |
| Production | Update when ready |

## 📚 Additional Documentation

- **Full Deployment Guide:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Quick Start:** [DEPLOYMENT-QUICK-START.md](DEPLOYMENT-QUICK-START.md)
- **Project Overview:** [project-overview.md](project-overview.md)

## ✨ Ready to Go!

You're all set! Run the commands above and your control will be deployed to:

**https://d365-salesandcustomerservice-dev.crm6.dynamics.com**

Good luck with your deployment! 🎉
