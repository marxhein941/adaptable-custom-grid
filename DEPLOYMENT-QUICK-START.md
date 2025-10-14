# Quick Start Deployment Guide

**Your Environment ID:** `7bb0a84d-b404-edfa-8662-ae4e0c225cc5`

## Step 1: Find Your Dataverse Environment URL

You provided the Power Apps maker portal URL, but we need the **Dataverse environment URL** for deployment.

### Option A: Use Power Platform Admin Center (Easiest)

1. Go to: https://admin.powerplatform.microsoft.com/
2. Click **"Environments"** in the left menu
3. Find your environment (it will have ID: `7bb0a84d-b404-edfa-8662-ae4e0c225cc5`)
4. Click on the environment name
5. Look for **"Environment URL"** in the Details section
6. Copy the URL - it will look like:
   - `https://orgname.crm.dynamics.com` (for US)
   - `https://orgname.crm4.dynamics.com` (for EMEA)
   - `https://orgname.crm5.dynamics.com` (for APAC)
   - etc.

### Option B: Check from Power Apps

1. Go to your environment: https://make.powerapps.com/environments/7bb0a84d-b404-edfa-8662-ae4e0c225cc5/home
2. Click the **gear icon** (⚙️) in the top right
3. Click **"Session details"**
4. Look for **"Instance url"** - copy this URL

### Option C: Use pac CLI to discover

```powershell
# This will prompt you to log in and show your environments
pac org list
```

## Step 2: Update environments.json

Once you have your Dataverse URL, update the file:

**Edit:** `environments.json`

Replace this line:
```json
"url": "https://yourorg-pp.crm.dynamics.com",
```

With your actual URL:
```json
"url": "https://YOUR-ACTUAL-ORG.crm.dynamics.com",
```

Example:
```json
{
  "publisher": {
    "name": "Adaptable",
    "prefix": "ada"
  },
  "environments": {
    "pp": {
      "name": "PP",
      "url": "https://opal.crm.dynamics.com",  // <-- Your actual URL here
      "publisherPrefix": "ada",
      "description": "Pre-production environment"
    }
  }
}
```

## Step 3: Authenticate

After updating the URL, authenticate:

```powershell
pac auth create --url https://YOUR-ACTUAL-URL.crm.dynamics.com --name PP
```

This will:
- Open a browser window
- Ask you to log in with your Microsoft credentials
- Store the authentication securely

## Step 4: Deploy

```powershell
# Simply run the deployment script
.\deploy-pp.ps1

# The script will:
# 1. Select your authenticated PP profile
# 2. Build the control (npm run build)
# 3. Deploy to your environment (pac pcf push --publisher-prefix ada)
```

## Step 5: Add to Your Model-Driven App

1. Go to: https://make.powerapps.com/
2. Open your **model-driven app** in the designer
3. Navigate to the view where you want the grid
4. Click **"Components"** → **"Get more components"**
5. Find **"GridChangeTracker"**
6. Click **"Add"**
7. Configure the properties:
   - Enable Change Tracking: Yes
   - Changed Cell Background Color: `#FFF4CE`
   - Aggregation Mode: Sum/Average/Count/None
   - Show Change Asterisk: Yes
8. **Save** and **Publish** your app

## Need Help Finding the URL?

If you're having trouble finding the Dataverse URL:

### Method 1: Check Developer Tools
1. Open your Power Apps maker portal
2. Press **F12** to open Developer Tools
3. Go to the **Network** tab
4. Refresh the page
5. Look for API calls to `.api.crm.dynamics.com` or similar
6. The domain before `.api.crm` is your environment URL

### Method 2: Check in a Model-Driven App
1. Open any model-driven app in your environment
2. Look at the browser URL bar
3. The domain will be your Dataverse URL
4. Example: `https://opal.crm.dynamics.com/main.aspx...`
   - Your URL is: `https://opal.crm.dynamics.com`

## Common URL Formats by Region

| Region | Format Example |
|--------|---------------|
| North America | `https://orgname.crm.dynamics.com` |
| EMEA | `https://orgname.crm4.dynamics.com` |
| APAC | `https://orgname.crm5.dynamics.com` |
| South America | `https://orgname.crm2.dynamics.com` |
| Canada | `https://orgname.crm3.dynamics.com` |
| UK | `https://orgname.crm11.dynamics.com` |
| India | `https://orgname.crm8.dynamics.com` |
| Australia | `https://orgname.crm6.dynamics.com` |

## Troubleshooting

**"No profiles found"**
- You need to run `pac auth create` first

**"Invalid URL"**
- Make sure you're using the Dataverse URL, not the maker portal URL
- Check that the URL starts with `https://`

**"Permission denied"**
- Ensure you have System Administrator or System Customizer role in the environment

**Control doesn't appear after deployment**
- Wait 5-10 minutes
- Clear browser cache
- Verify deployment with: `pac auth list`

---

**Once you provide the Dataverse URL, I can update the configuration for you!**
