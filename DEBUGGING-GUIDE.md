# PCF Control Debugging Guide

## Methods to Capture Error Messages

### Method 1: Browser Console (Recommended)

1. **Open your Power Apps environment in a browser**
   - Go to https://make.powerapps.com/environments/7bb0a84d-b404-edfa-8662-ae4e0c225cc5/home

2. **Open Browser Developer Tools**
   - Press **F12** (or Ctrl+Shift+I)
   - Click on the **Console** tab

3. **Enable Verbose Logging**
   - In Console, click the "Default levels" dropdown
   - Make sure these are checked: Verbose, Info, Warnings, Errors

4. **Try Adding the Component**
   - Keep the console open
   - Try adding the GridChangeTracker control to your app
   - Watch for any error messages (in red)

5. **Look for These Specific Error Patterns**
   ```
   GridChangeTracker initialized
   GridChangeTracker updateView
   Error loading control: ...
   Failed to load component: ...
   ```

### Method 2: Network Tab (For Import/API Errors)

1. **Open Developer Tools** (F12)
2. **Go to Network tab**
3. **Try adding the component again**
4. **Look for failed requests** (shown in red, status 4xx or 5xx)
5. **Click on failed requests** to see:
   - Headers
   - Response (detailed error message)
   - Preview

### Method 3: Monitor Control Loading

Run this script in the browser console to intercept control loading:

```javascript
// Paste this in the browser console while in Power Apps
(function() {
    console.log('%c[DEBUG] PCF Monitor Started', 'color: green; font-weight: bold');

    // Capture all console messages
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = function(...args) {
        console.log('%c[ERROR CAPTURED]', 'color: red; font-weight: bold', args);
        originalError.apply(console, args);
    };

    console.warn = function(...args) {
        console.log('%c[WARNING CAPTURED]', 'color: orange; font-weight: bold', args);
        originalWarn.apply(console, args);
    };

    // Monitor for PCF control errors
    window.addEventListener('error', function(e) {
        if (e.message.includes('GridChangeTracker') || e.message.includes('AdaptableControls')) {
            console.log('%c[PCF ERROR DETECTED]', 'color: red; font-weight: bold', {
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                error: e.error
            });
        }
    });

    console.log('%c[DEBUG] Monitoring for GridChangeTracker errors...', 'color: blue; font-weight: bold');
})();
```

### Method 4: Check Control Registration

Run this in browser console to verify the control is registered:

```javascript
// Check if control is available
fetch(window.location.origin + '/api/data/v9.1/customcontrols?$filter=contains(name,%27GridChangeTracker%27)')
    .then(r => r.json())
    .then(data => {
        console.log('%c[CONTROL CHECK]', 'color: blue; font-weight: bold', data);
        if (data.value && data.value.length > 0) {
            console.log('%c✓ Control is registered', 'color: green; font-weight: bold', data.value[0]);
        } else {
            console.log('%c✗ Control NOT found', 'color: red; font-weight: bold');
        }
    })
    .catch(e => console.error('Failed to check control:', e));
```

### Method 5: Solution Checker Report

Check the Solution Checker report mentioned during deployment:

**URL Format:**
```
https://d365-salesandcustomerservice-dev.crm6.dynamics.com/api/data/v9.1/msdyn_analysisjobs(179108ec-0ba9-f011-bbd3-6045bde58885)/msdyn_analysisjobsreport/$value
```

To access it:
1. Copy the URL from the deployment output
2. Paste it in your browser (while logged into Power Platform)
3. It will download a report file

### Method 6: Enable Fiddler for Deep Debugging

For advanced debugging:

1. **Install Fiddler Classic**
   - Download from https://www.telerik.com/download/fiddler

2. **Configure Fiddler**
   - Tools → Options → HTTPS
   - Check "Decrypt HTTPS traffic"
   - Check "Ignore server certificate errors"

3. **Start Fiddler and reproduce the error**
   - All requests will be captured
   - Look for requests to your environment URL
   - Check responses for detailed error messages

## Common Error Messages and Solutions

### "Control type not supported"
**Cause:** Control manifest issue or wrong control type
**Solution:** Verify `control-type="virtual"` in ControlManifest.Input.xml

### "Platform library not supported"
**Cause:** Unsupported library version
**Solution:** Use React 16.14.0 and Fluent 9.46.2 (already fixed)

### "Dataset configuration missing"
**Cause:** Control requires a dataset but none is configured
**Solution:** Ensure you're adding the control to a grid/view, not a form field

### "Failed to load component resources"
**Cause:** Bundle.js or CSS not properly loaded
**Solution:** Clear browser cache and republish customizations

### "WebAPI not available"
**Cause:** WebAPI feature not enabled or permissions issue
**Solution:** Verify `<uses-feature name="WebAPI" required="true" />` in manifest

## Testing Locally

To test the control locally before deploying:

```bash
# Navigate to project directory
cd C:\Users\marxh\OneDrive\Documents\Werk\Adaptable\Clients\Opal\SFTApp\PCF\adaptable-custom-grid

# Start test harness
npm start watch
```

This opens a local test environment where you can see errors immediately.

## Verbose Logging

The control already includes console logging for:
- Initialization: `GridChangeTracker initialized`
- Updates: `GridChangeTracker updateView`
- Cell changes: `Cell changed`
- Save operations: `Starting save operation`
- Errors: `Error handling cell change` / `Error saving changes`

## Export Console Logs

To save console output:

1. Right-click in console
2. Select "Save as..."
3. Save the log file
4. Share with support/developers

## Power Platform Admin Center Logs

1. Go to https://admin.powerplatform.microsoft.com/
2. Select your environment
3. Click "History" in the left menu
4. Look for recent solution imports
5. Check for any errors or warnings

## Contact Information

If errors persist:
- Review the console output
- Check the Solution Checker report
- Review network requests for API errors
- Test in local test harness
