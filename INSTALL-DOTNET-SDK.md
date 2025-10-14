# Install .NET SDK for PCF Deployment

The PCF deployment requires .NET SDK (MSBuild) to create solution packages.

## Quick Install Steps

### Step 1: Download .NET SDK

**Option A: .NET 8.0 SDK (Recommended)**
- Direct download: https://dotnet.microsoft.com/download/dotnet/8.0
- Click **"Download .NET SDK x64"** for Windows

**Option B: .NET 6.0 SDK (LTS)**
- Direct download: https://dotnet.microsoft.com/download/dotnet/6.0
- Click **"Download .NET SDK x64"** for Windows

### Step 2: Install

1. Run the downloaded installer (e.g., `dotnet-sdk-8.0.xxx-win-x64.exe`)
2. Follow the installation wizard
3. Click **"Install"**
4. Wait for completion (1-2 minutes)
5. Click **"Close"**

### Step 3: Verify Installation

**Close and reopen PowerShell**, then run:

```powershell
dotnet --version
```

Expected output: `8.0.xxx` or `6.0.xxx`

If you see a version number, you're ready to deploy! ✅

### Step 4: Deploy Your PCF Control

```powershell
# Navigate to project directory (if not already there)
cd C:\Users\marxh\OneDrive\Documents\Werk\Adaptable\Clients\Opal\SFTApp\PCF\adaptable-custom-grid

# Select your authenticated environment
pac auth select --name PP

# Deploy the control
pac pcf push --publisher-prefix ada
```

## What Happens During Deployment

When you run `pac pcf push`, it will:

1. ✓ Check if control already exists
2. ✓ Create a temporary solution wrapper
3. ✓ Build the solution using MSBuild (requires .NET SDK)
4. ✓ Import the control into Dataverse
5. ✓ Register the control in your environment

Expected output:
```
Using publisher prefix 'ada'.
Checking if the control 'ada_AdaptableControls.GridChangeTracker' already exists...
Creating a temporary solution wrapper...
Building the temporary solution wrapper...
Importing solution package...
Control imported successfully.
```

## Troubleshooting

**"dotnet: command not found" after install**
- Close ALL PowerShell/Terminal windows
- Open a NEW PowerShell window
- Try `dotnet --version` again

**Still getting MSBuild error**
- Restart your computer
- Verify PATH was updated: `$env:PATH -split ';' | Select-String dotnet`

**"Access denied" during install**
- Run the installer as Administrator
- Right-click installer → "Run as administrator"

## Alternative: Chocolatey Install

If you have Chocolatey package manager:

```powershell
choco install dotnet-sdk -y
```

## After Successful Install

You'll be able to:
- ✅ Deploy PCF controls with `pac pcf push`
- ✅ Build solution packages
- ✅ Use MSBuild for .NET projects

---

**Once installed, return to PowerShell and deploy!** 🚀
