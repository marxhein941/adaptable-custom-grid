# Grid Change Tracker - Deployment Guide

Complete guide for deploying the PCF control to Power Platform environments.

## Prerequisites

- Power Platform CLI installed ([Download](https://aka.ms/PowerAppsCLI))
- Node.js and npm installed
- Access to your Dataverse environment with system administrator or customizer role

## Understanding Authentication

**Important:** Credentials are NEVER stored in code or configuration files.

The Power Platform CLI manages authentication securely through profiles:
- Authentication credentials are stored by the `pac` CLI tool on your machine
- You authenticate once per environment and can reuse the profile
- Profiles are stored locally and are NOT committed to the repository

## First-Time Setup

### 1. Update Configuration Files

Edit `environments.json` and update:
```json
{
  "environments": {
    "pp": {
      "url": "https://YOUR-ACTUAL-ORG-pp.crm.dynamics.com",  // Update this
      "publisherPrefix": "YOUR-PREFIX"                        // Update this
    }
  }
}
```

**Find your values:**
- **Environment URL**: Go to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com/) → Select your environment → Copy the Environment URL
- **Publisher Prefix**: Go to make.powerapps.com → Solutions → Select your solution → Publisher → Note the prefix (e.g., "contoso", "abc")

### 2. Authenticate to Your Environment

Run this command **ONCE** per environment:

```powershell
# For PP environment
pac auth create --url https://YOUR-ORG-pp.crm.dynamics.com --name PP

# You will be prompted to log in via browser
# Credentials are stored securely by pac CLI
```

To see your authenticated profiles:
```powershell
pac auth list
```

To switch between profiles:
```powershell
pac auth select --name PP
```

## Deployment Options

### Option 1: Using Deployment Scripts (Recommended)

**Deploy to PP:**
```powershell
.\deploy-pp.ps1 -PublisherPrefix "YOUR-PREFIX"
```

**Deploy to DEV:**
```powershell
.\deploy-dev.ps1 -PublisherPrefix "YOUR-PREFIX"
```

The scripts will:
1. ✓ Check if pac CLI is installed
2. ✓ Select the correct environment
3. ✓ Build the control
4. ✓ Deploy to the environment
5. ✓ Show next steps

### Option 2: Manual Deployment

```powershell
# 1. Select environment
pac auth select --name PP

# 2. Build control
npm run build

# 3. Deploy
pac pcf push --publisher-prefix YOUR-PREFIX
```

## After Deployment

### Add Control to Your App

1. Go to [Power Apps](https://make.powerapps.com)
2. Open your model-driven app in the designer
3. Select a view for your entity
4. Click **Components** → **Get more components**
5. Find **GridChangeTracker** in the list
6. Click **Add** to add it to your view
7. Configure properties:
   - **Enable Change Tracking**: On/Off
   - **Changed Cell Background Color**: `#FFF4CE` (or your color)
   - **Aggregation Mode**: None/Sum/Average/Count
   - **Show Change Asterisk**: On/Off
8. **Save** and **Publish** your app

### Configure the Control

The control has the following configurable properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| Enable Change Tracking | Yes/No | Yes | Show visual indicators for changed cells |
| Changed Cell Background Color | Text | #FFF4CE | Background color for modified cells |
| Aggregation Mode | Enum | None | Display Sum, Average, Count, or None |
| Show Change Asterisk | Yes/No | Yes | Display asterisk (*) for changed cells |

## Updating the Control

When you make changes to the code:

```powershell
# 1. Make your code changes
# 2. Build
npm run build

# 3. Deploy (increment version in ControlManifest.Input.xml first!)
pac auth select --name PP
pac pcf push --publisher-prefix YOUR-PREFIX
```

**Important:** Increment the version number in `ControlManifest.Input.xml` before each deployment:
```xml
<control version="0.0.3" ...>
```

## Troubleshooting

### "pac: command not found"
- Install Power Platform CLI: https://aka.ms/PowerAppsCLI
- Restart your terminal after installation

### "Could not select environment"
- Run `pac auth create` first to authenticate
- Check that the environment name matches (case-sensitive)

### "Build failed"
- Run `npm install` to ensure dependencies are installed
- Check for TypeScript/ESLint errors in the output

### "Deployment failed - publisher prefix invalid"
- Verify your publisher prefix is correct
- Check that you have permissions in the environment

### Control doesn't appear in "Get more components"
- Wait 5-10 minutes after deployment
- Clear browser cache
- Verify deployment succeeded with `pac auth list`

### Changes not appearing after update
- Increment version in ControlManifest.Input.xml
- Clear browser cache (Ctrl+F5)
- Republish your model-driven app

## Environment Management

### List All Authenticated Environments
```powershell
pac auth list
```

### Add New Environment
```powershell
pac auth create --url https://org.crm.dynamics.com --name ENVNAME
```

### Delete Environment Profile
```powershell
pac auth delete --name ENVNAME
```

### Clear All Profiles
```powershell
pac auth clear
```

## Security Notes

- ✅ Authentication credentials are stored securely by pac CLI
- ✅ No credentials are in source control
- ✅ Each developer authenticates with their own credentials
- ✅ Use service accounts for CI/CD pipelines
- ⚠️ Never commit `environments.json` with real URLs (use placeholders)

## Solution-Based Deployment (Advanced)

For production deployments, use solutions:

```powershell
# 1. Create solution folder
cd ..
mkdir GridChangeTrackerSolution
cd GridChangeTrackerSolution

# 2. Initialize solution
pac solution init --publisher-name "YourCompany" --publisher-prefix "YOUR-PREFIX"

# 3. Add PCF reference
pac solution add-reference --path ../adaptable-custom-grid

# 4. Build solution
msbuild /t:build /restore

# 5. Import solution zip from bin/Debug/ via Power Platform
```

## Support

For issues or questions:
- Review [PCF Documentation](https://docs.microsoft.com/power-apps/developer/component-framework/overview)
- Check [Power Platform CLI Reference](https://docs.microsoft.com/power-platform/developer/cli/reference/pcf)
- GitHub Issues: https://github.com/marxhein941/adaptable-custom-grid/issues
