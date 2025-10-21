# Production Deployment Guide for Adaptable Custom Grid PCF Control

## Overview
This guide outlines the complete process for taking the Adaptable Custom Grid PCF control from development to production-ready status, including packaging as a managed solution, establishing ownership, and preparing for distribution through public or private channels.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Control Metadata Configuration](#control-metadata-configuration)
3. [Solution Packaging](#solution-packaging)
4. [Creating a Managed Solution](#creating-a-managed-solution)
5. [Testing and Validation](#testing-and-validation)
6. [Distribution Options](#distribution-options)
7. [Maintenance and Versioning](#maintenance-and-versioning)
8. [Security and Compliance](#security-and-compliance)

## Prerequisites

### Required Tools
- Power Platform CLI (PAC CLI) - Latest version
- Node.js (v16 or higher)
- Visual Studio Code or preferred IDE
- Azure DevOps or GitHub account (for version control)
- Power Platform environment with System Administrator access

### Environment Setup
```bash
# Verify PAC CLI installation
pac --version

# Authenticate to your environment
pac auth create --environment https://[your-org].crm.dynamics.com

# List available environments
pac auth list
```

## Control Metadata Configuration

### 1. Update Control Manifest (ControlManifest.Input.xml)

The control manifest needs proper metadata for production deployment:

```xml
<?xml version="1.0" encoding="utf-8" ?>
<manifest>
  <control
    namespace="Adaptable"
    constructor="GridChangeTracker"
    version="1.0.0"
    display-name-key="Adaptable_Custom_Grid_Display"
    description-key="Adaptable_Custom_Grid_Description"
    control-type="standard"
    preview-image="img/preview.png"
    >

    <!-- Add publisher information -->
    <publisher
      name="Adaptable Solutions"
      prefix="ada"
      />

    <!-- Add supported platforms -->
    <platform-library name="React" version="16.8.6" />
    <platform-library name="Fluent" version="8.29.0" />

    <!-- Add feature usage declarations -->
    <feature-usage>
      <uses-feature name="WebAPI" required="true" />
      <uses-feature name="Utility" required="true" />
      <uses-feature name="Device" required="false" />
    </feature-usage>

    <!-- Existing data-set and property configurations -->
    <!-- ... -->

    <!-- Add resources with proper descriptions -->
    <resources>
      <code path="index.ts" order="1" />
      <css path="css/GridChangeTracker.css" order="2" />
      <img path="img/preview.png" />
      <resx path="strings/GridChangeTracker.1033.resx" version="1.0.0" />
    </resources>
  </control>
</manifest>
```

### 2. Create Publisher Configuration

Create a publisher definition file (`publisher.xml`):

```xml
<?xml version="1.0" encoding="utf-8"?>
<Publisher xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <UniqueName>AdaptableSolutions</UniqueName>
  <LocalizedNames>
    <LocalizedName languagecode="1033">Adaptable Solutions</LocalizedName>
  </LocalizedNames>
  <Descriptions>
    <Description languagecode="1033">Publisher of enterprise Power Platform components</Description>
  </Descriptions>
  <EMailAddress>support@adaptablesolutions.com</EMailAddress>
  <SupportingWebsiteUrl>https://www.adaptablesolutions.com</SupportingWebsiteUrl>
  <Addresses>
    <Address>
      <City>Your City</City>
      <Country>Your Country</Country>
      <Line1>Your Address</Line1>
      <PostalCode>Your Postal Code</PostalCode>
      <StateOrProvince>Your State</StateOrProvince>
    </Address>
  </Addresses>
</Publisher>
```

### 3. Add Localization Resources

Create proper resource files for multi-language support:

`strings/GridChangeTracker.1033.resx` (English):
```xml
<?xml version="1.0" encoding="utf-8"?>
<root>
  <data name="Adaptable_Custom_Grid_Display" xml:space="preserve">
    <value>Adaptable Custom Grid</value>
  </data>
  <data name="Adaptable_Custom_Grid_Description" xml:space="preserve">
    <value>Advanced grid control with inline editing, filtering, sorting, and aggregation capabilities</value>
  </data>
  <data name="Dataset_Display_Key" xml:space="preserve">
    <value>Dataset</value>
  </data>
  <data name="Dataset_Desc_Key" xml:space="preserve">
    <value>The dataset to display in the grid</value>
  </data>
</root>
```

## Solution Packaging

### 1. Create Solution Directory Structure

```
adaptable-custom-grid-solution/
├── src/
│   └── Other/
│       ├── Solution.xml
│       └── Customizations.xml
├── Controls/
│   └── ada_AdaptableCustomGrid/
│       ├── ControlManifest.Input.xml
│       └── ... (control files)
└── package.json
```

### 2. Create Solution Configuration

`Solution.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml version="9.2" SolutionPackageVersion="9.2" languagecode="1033">
  <SolutionManifest>
    <UniqueName>AdaptableCustomGridControl</UniqueName>
    <LocalizedNames>
      <LocalizedName description="Adaptable Custom Grid Control" languagecode="1033" />
    </LocalizedNames>
    <Descriptions>
      <Description description="Production-ready grid control with advanced features" languagecode="1033" />
    </Descriptions>
    <Version>1.0.0.0</Version>
    <Managed>2</Managed>
    <Publisher>
      <UniqueName>AdaptableSolutions</UniqueName>
    </Publisher>
    <RootComponents>
      <RootComponent type="66" id="{control-guid}" behavior="0" />
    </RootComponents>
  </SolutionManifest>
</ImportExportXml>
```

### 3. Build and Package Commands

```bash
# Clean previous builds
npm run clean

# Build the control in production mode
npm run build -- --production

# Create solution project
pac solution init --publisher-name "AdaptableSolutions" --publisher-prefix "ada"

# Add the control to solution
pac solution add-reference --path ../

# Build the solution
msbuild /t:restore
msbuild /p:Configuration=Release

# Package as managed solution
msbuild /t:restore /p:Configuration=Managed
msbuild /p:Configuration=Managed
```

## Creating a Managed Solution

### 1. Configure Managed Properties

Add to your solution's `customizations.xml`:

```xml
<EntityMaps />
<OptionSets />
<CustomControls>
  <CustomControl Name="ada_AdaptableCustomGrid">
    <CanBeDeleted>0</CanBeDeleted>
    <IsCustomizable>0</IsCustomizable>
    <IsHidden>0</IsHidden>
    <IsManaged>1</IsManaged>
  </CustomControl>
</CustomControls>
```

### 2. Solution Packaging Script

Create `build-managed.ps1`:

```powershell
# PowerShell script for building managed solution
param(
    [Parameter(Mandatory=$true)]
    [string]$Version,

    [Parameter(Mandatory=$false)]
    [string]$PublisherPrefix = "ada"
)

Write-Host "Building Managed Solution v$Version" -ForegroundColor Green

# Clean previous builds
Remove-Item -Path "./dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "./obj" -Recurse -Force -ErrorAction SilentlyContinue

# Update version in control manifest
$manifest = Get-Content "./GridChangeTracker/ControlManifest.Input.xml"
$manifest = $manifest -replace 'version=".*?"', "version=`"$Version`""
Set-Content -Path "./GridChangeTracker/ControlManifest.Input.xml" -Value $manifest

# Build control
npm run build -- --production

# Initialize solution if not exists
if (-not (Test-Path "./Solutions")) {
    pac solution init `
        --publisher-name "Adaptable Solutions" `
        --publisher-prefix $PublisherPrefix `
        --outputDirectory "./Solutions"
}

# Add control reference
Set-Location "./Solutions"
pac solution add-reference --path "../"

# Build managed solution
msbuild /t:restore /p:Configuration=Managed
msbuild /p:Configuration=Managed /p:DeploymentType=Managed

# Create output directory
$outputDir = "../releases/v$Version"
New-Item -Path $outputDir -ItemType Directory -Force

# Copy solution files
Copy-Item "./bin/Managed/AdaptableCustomGrid_managed.zip" "$outputDir/"
Copy-Item "./bin/Managed/AdaptableCustomGrid.zip" "$outputDir/AdaptableCustomGrid_unmanaged.zip"

Write-Host "Managed solution created at: $outputDir" -ForegroundColor Green
```

### 3. Sign the Solution (Optional but Recommended)

For production deployments, consider signing your solution:

```bash
# Generate a strong name key
sn -k AdaptableCustomGrid.snk

# Add to your project file
<PropertyGroup>
  <SignAssembly>true</SignAssembly>
  <AssemblyOriginatorKeyFile>AdaptableCustomGrid.snk</AssemblyOriginatorKeyFile>
</PropertyGroup>
```

## Testing and Validation

### 1. Pre-Deployment Checklist

- [ ] All TypeScript/JavaScript errors resolved
- [ ] ESLint warnings addressed
- [ ] Unit tests passing (if applicable)
- [ ] Control tested in all target environments
- [ ] Performance benchmarks met
- [ ] Accessibility standards compliance (WCAG 2.1 Level AA)
- [ ] Browser compatibility verified (Edge, Chrome, Firefox, Safari)
- [ ] Mobile responsiveness tested
- [ ] Memory leak testing completed
- [ ] Security scanning performed

### 2. Solution Checker Validation

```bash
# Run solution checker
pac solution check --path ./releases/v1.0.0/AdaptableCustomGrid_managed.zip

# Export results
pac solution check-result --solutionCheckResultId {result-id} --outputDirectory ./test-results
```

### 3. Test Deployment Script

Create `test-deploy.ps1`:

```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$EnvironmentUrl,

    [Parameter(Mandatory=$true)]
    [string]$SolutionPath
)

# Authenticate
pac auth create --url $EnvironmentUrl

# Import solution
pac solution import `
    --path $SolutionPath `
    --force-overwrite `
    --publish-changes `
    --activate-plugins

Write-Host "Solution deployed to: $EnvironmentUrl" -ForegroundColor Green
```

## Distribution Options

### 1. AppSource Publishing (Public Distribution)

#### Requirements:
- Microsoft Partner Network (MPN) account
- Business verification completed
- Solution certified through AppSource validation

#### Steps:
1. Create Partner Center account
2. Submit app for certification
3. Provide required documentation:
   - User manual
   - Installation guide
   - Support documentation
   - Privacy policy
   - Terms of use

#### Submission Package Structure:
```
AppSourceSubmission/
├── Solution/
│   ├── AdaptableCustomGrid_managed.zip
│   └── AdaptableCustomGrid_unmanaged.zip
├── Documentation/
│   ├── UserGuide.pdf
│   ├── InstallationGuide.pdf
│   └── ReleaseNotes.md
├── Marketing/
│   ├── Screenshots/
│   ├── Videos/
│   └── ProductDescription.md
└── Legal/
    ├── PrivacyPolicy.pdf
    └── TermsOfUse.pdf
```

### 2. Private Distribution

#### Internal Organization:
```bash
# Deploy to production environment
pac solution import `
    --path ./AdaptableCustomGrid_managed.zip `
    --environment-url https://org.crm.dynamics.com `
    --managed true
```

#### Customer-Specific Deployment:
1. Create customer-specific solution
2. Include customer customizations
3. Package with customer prefix
4. Deploy to customer tenant

### 3. GitHub/Package Registry Distribution

Create `package.json` for npm distribution:

```json
{
  "name": "@adaptable/custom-grid-pcf",
  "version": "1.0.0",
  "description": "Adaptable Custom Grid PCF Control",
  "main": "index.js",
  "files": [
    "dist/",
    "ControlManifest.Input.xml",
    "README.md",
    "LICENSE"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/adaptable/custom-grid-pcf.git"
  },
  "keywords": [
    "pcf",
    "powerapps",
    "grid",
    "dynamics365"
  ],
  "author": "Adaptable Solutions",
  "license": "MIT",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

## Maintenance and Versioning

### 1. Semantic Versioning Strategy

Follow semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### 2. Version Update Process

```bash
# Update version in manifest
npm version patch  # or minor/major

# Update solution version
pac solution version --patchversion 1

# Tag release in git
git tag -a v1.0.1 -m "Release version 1.0.1"
git push origin v1.0.1
```

### 3. Upgrade Path Documentation

Create `UPGRADE.md`:

```markdown
# Upgrade Guide

## From 1.0.x to 1.1.x
- No breaking changes
- New features added:
  - Column resizing
  - Enhanced aggregations

## Migration Steps
1. Export data customizations
2. Import new managed solution
3. Verify column mappings
4. Test in sandbox environment
```

### 4. Release Notes Template

`RELEASE_NOTES.md`:

```markdown
# Release Notes - v1.0.0

## New Features
- Dynamic column resizing
- Aggregation footer with sum/average/count
- Inline editing with change tracking
- Advanced filtering per column

## Improvements
- Performance optimizations for large datasets
- Enhanced accessibility support

## Bug Fixes
- Fixed column header overflow
- Resolved aggregation alignment issues

## Known Issues
- None

## Upgrade Instructions
See UPGRADE.md for detailed instructions
```

## Security and Compliance

### 1. Security Checklist

- [ ] No hardcoded credentials
- [ ] API keys stored in environment variables
- [ ] XSS prevention implemented
- [ ] SQL injection prevention (if applicable)
- [ ] Content Security Policy (CSP) compliant
- [ ] Data encryption at rest and in transit
- [ ] OWASP Top 10 compliance verified

### 2. Compliance Requirements

#### GDPR Compliance:
- Data minimization
- Right to erasure implementation
- Data portability support
- Privacy by design

#### Accessibility (WCAG 2.1):
- Keyboard navigation support
- Screen reader compatibility
- Proper ARIA labels
- Color contrast ratios met

### 3. Security Headers

Add to web resources:
```javascript
// Content Security Policy
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';">

// Additional security headers
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="X-Frame-Options" content="SAMEORIGIN">
<meta http-equiv="X-XSS-Protection" content="1; mode=block">
```

## Automated Deployment Pipeline

### Azure DevOps Pipeline (`azure-pipelines.yml`)

```yaml
trigger:
  tags:
    include:
      - v*

pool:
  vmImage: 'windows-latest'

variables:
  solution: 'AdaptableCustomGrid'
  buildConfiguration: 'Managed'

stages:
- stage: Build
  jobs:
  - job: BuildSolution
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: '16.x'

    - task: Npm@1
      inputs:
        command: 'install'

    - task: Npm@1
      inputs:
        command: 'custom'
        customCommand: 'run build -- --production'

    - task: PowerPlatformToolInstaller@2
      inputs:
        DefaultVersion: true

    - task: MSBuild@1
      inputs:
        solution: '**/*.cdsproj'
        configuration: '$(buildConfiguration)'

    - task: PowerPlatformChecker@2
      inputs:
        FilesToAnalyze: '$(Build.SourcesDirectory)\bin\$(buildConfiguration)\$(solution)_managed.zip'
        RuleSet: '0ad12346-e108-40b8-a956-9a8f95ea18c9'

    - task: PublishBuildArtifacts@1
      inputs:
        PathtoPublish: '$(Build.SourcesDirectory)\bin\$(buildConfiguration)'
        ArtifactName: 'drop'

- stage: Deploy
  condition: and(succeeded(), startsWith(variables['Build.SourceBranch'], 'refs/tags/v'))
  jobs:
  - deployment: DeployToProduction
    environment: 'Production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: PowerPlatformImportSolution@2
            inputs:
              authenticationType: 'PowerPlatformSPN'
              PowerPlatformSPN: 'PowerPlatform-Production'
              SolutionInputFile: '$(Pipeline.Workspace)/drop/$(solution)_managed.zip'
              AsyncOperation: true
              MaxAsyncWaitTime: '60'
```

## Final Production Checklist

### Pre-Production Validation
- [ ] Code review completed
- [ ] Security scan passed
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Licensing defined
- [ ] Support process established

### Solution Package
- [ ] Managed solution created
- [ ] Publisher information configured
- [ ] Version number updated
- [ ] Solution dependencies documented
- [ ] Upgrade path tested

### Documentation
- [ ] User guide completed
- [ ] Installation guide prepared
- [ ] API documentation (if applicable)
- [ ] Troubleshooting guide created
- [ ] Release notes updated

### Legal and Compliance
- [ ] License agreement prepared
- [ ] Privacy policy updated
- [ ] Terms of service defined
- [ ] Export compliance verified
- [ ] Accessibility compliance validated

### Distribution Setup
- [ ] Distribution channel selected
- [ ] Package repository configured
- [ ] Support contact established
- [ ] Update mechanism defined
- [ ] Telemetry/analytics configured (optional)

## Support and Maintenance

### Support Structure
- **Email**: support@adaptablesolutions.com
- **Documentation**: https://docs.adaptablesolutions.com/custom-grid
- **Issue Tracking**: GitHub Issues or Azure DevOps Boards
- **SLA**: Define based on license type

### Monitoring and Telemetry
```javascript
// Add telemetry (optional)
public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
    // Telemetry initialization
    if (window.applicationInsights) {
        window.applicationInsights.trackEvent("ControlInitialized", {
            version: "1.0.0",
            environment: context.mode.allocatedHeight ? "Canvas" : "ModelDriven"
        });
    }
    // ... rest of init
}
```

## Conclusion

Following this guide ensures your PCF control is:
1. **Production-ready**: Tested, validated, and optimized
2. **Properly packaged**: As a managed solution with correct metadata
3. **Distributable**: Through AppSource, private channels, or package registries
4. **Maintainable**: With proper versioning and upgrade paths
5. **Compliant**: With security, accessibility, and legal requirements

Regular updates and maintenance following these guidelines will ensure the control remains reliable and valuable for end users.