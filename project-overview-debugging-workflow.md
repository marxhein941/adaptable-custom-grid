Excellent question! Debugging deployed PCF controls is crucial. Here's your comprehensive debugging guide:

## Browser DevTools - Your Primary Debug Tool

### Step 1: Open DevTools in Your Model-Driven App

```bash
# In your model-driven app with the PCF control:
Press F12 (Windows/Linux) or Cmd+Option+I (Mac)

# Or right-click anywhere → "Inspect"
```

### Step 2: Navigate to Console Tab

The Console shows:
- Your `console.log()` statements
- JavaScript errors
- PCF framework messages
- Network errors

## Adding Debug Logging to Your PCF Control

### In Your TypeScript Code

**`index.ts` - Add logging to lifecycle methods:**

```typescript
export class GridChangeTracker implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    
    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        // Add debug logging
        console.log('[GridChangeTracker] Init called', {
            parameters: context.parameters,
            mode: context.mode,
            userSettings: context.userSettings
        });
        
        try {
            this.container = container;
            this.notifyOutputChanged = notifyOutputChanged;
            console.log('[GridChangeTracker] Init completed successfully');
        } catch (error) {
            console.error('[GridChangeTracker] Init failed:', error);
            // Log full error details
            console.error('[GridChangeTracker] Error stack:', error.stack);
        }
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        console.log('[GridChangeTracker] UpdateView called');
        
        // Log dataset state
        const dataset = context.parameters.gridDataset;
        console.log('[GridChangeTracker] Dataset info:', {
            loading: dataset.loading,
            error: dataset.error,
            recordCount: dataset.sortedRecordIds.length,
            columns: dataset.columns.map(c => c.name),
            hasNextPage: dataset.paging.hasNextPage,
            hasPreviousPage: dataset.paging.hasPreviousPage
        });

        try {
            // Your rendering logic
            console.log('[GridChangeTracker] Rendering React component');
            ReactDOM.render(
                React.createElement(GridComponent, props),
                this.container
            );
            console.log('[GridChangeTracker] React component rendered successfully');
        } catch (error) {
            console.error('[GridChangeTracker] UpdateView failed:', error);
            console.error('[GridChangeTracker] Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        }
    }

    private handleSave(context: ComponentFramework.Context<IInputs>): void {
        console.log('[GridChangeTracker] Save initiated');
        console.log('[GridChangeTracker] Changed records:', 
            Array.from(this.changedRecords.entries())
        );
        
        const promises: Promise<any>[] = [];
        
        this.changedRecords.forEach((changes, recordId) => {
            console.log(`[GridChangeTracker] Updating record ${recordId}:`, changes);
            
            const entityName = context.parameters.gridDataset.getTargetEntityType();
            promises.push(
                context.webAPI.updateRecord(entityName, recordId, changes)
                    .then(result => {
                        console.log(`[GridChangeTracker] Record ${recordId} updated successfully:`, result);
                        return result;
                    })
                    .catch(error => {
                        console.error(`[GridChangeTracker] Failed to update record ${recordId}:`, error);
                        throw error;
                    })
            );
        });

        Promise.all(promises)
            .then(() => {
                console.log('[GridChangeTracker] All records saved successfully');
                this.changedRecords.clear();
                context.parameters.gridDataset.refresh();
            })
            .catch(error => {
                console.error('[GridChangeTracker] Bulk save failed:', error);
            });
    }
}
```

**`components/GridComponent.tsx` - Add React logging:**

```typescript
export const GridComponent: React.FC<IGridProps> = (props) => {
    console.log('[GridComponent] Component rendering', {
        datasetLoading: props.dataset.loading,
        recordCount: props.dataset.sortedRecordIds.length,
        enableChangeTracking: props.enableChangeTracking
    });

    React.useEffect(() => {
        console.log('[GridComponent] useEffect - loading data');
        try {
            const records = loadRecordsFromDataset(props.dataset);
            console.log('[GridComponent] Loaded records:', records);
            setOriginalData(new Map(records.map(r => [r.id, { ...r }])));
            setCurrentData(records);
            console.log('[GridComponent] Data initialization complete');
        } catch (error) {
            console.error('[GridComponent] Failed to load data:', error);
        }
    }, [props.dataset]);

    const handleCellChange = (recordId: string, columnName: string, newValue: any) => {
        console.log('[GridComponent] Cell changed:', {
            recordId,
            columnName,
            oldValue: currentData.find(r => r.id === recordId)?.[columnName],
            newValue
        });
        
        // Your logic here
    };

    return (
        <div>
            {console.log('[GridComponent] Rendering DetailsList')}
            <DetailsList {...props} />
        </div>
    );
};
```

### Create a Debug Utility

**`utils/debugLogger.ts`:**

```typescript
export class DebugLogger {
    private static prefix = '[GridChangeTracker]';
    private static isEnabled = true; // Toggle this for production

    static log(method: string, message: string, data?: any) {
        if (!this.isEnabled) return;
        
        const timestamp = new Date().toISOString();
        console.log(`${this.prefix} [${timestamp}] ${method}: ${message}`, data || '');
    }

    static error(method: string, message: string, error: any) {
        const timestamp = new Date().toISOString();
        console.error(`${this.prefix} [${timestamp}] ${method}: ${message}`, {
            message: error?.message,
            stack: error?.stack,
            error: error
        });
    }

    static table(method: string, data: any[]) {
        if (!this.isEnabled) return;
        console.log(`${this.prefix} ${method}:`);
        console.table(data);
    }

    static group(label: string, callback: () => void) {
        if (!this.isEnabled) {
            callback();
            return;
        }
        console.group(`${this.prefix} ${label}`);
        callback();
        console.groupEnd();
    }
}

// Usage:
// DebugLogger.log('init', 'Initializing control', { context });
// DebugLogger.error('updateView', 'Failed to render', error);
// DebugLogger.table('updateView', records);
```

## Using Power Apps Monitor (Built-in Debugging Tool)

### Step 1: Enable Monitor

```
1. Open your model-driven app
2. Add ?monitor=true to the URL
   Example: https://yourorg.crm.dynamics.com/main.aspx?appid=xxx&monitor=true

3. Or use the Monitor tool in Power Apps Studio
   - Go to make.powerapps.com
   - Open your app
   - Click "Monitor" in the top menu
```

### Step 2: Filter for Your PCF Control

Monitor shows:
- Control lifecycle events (init, updateView, destroy)
- Network calls (WebAPI requests)
- Performance metrics
- Errors and warnings

**Filter by:**
```
controlName eq "GridChangeTracker"
```

### Step 3: Export Monitor Data

Click "Export" to get JSON of all events - great for sharing with Claude Code!

## Browser DevTools - Advanced Techniques

### Sources Tab - Debugging with Breakpoints

```
1. Press Ctrl+P (Cmd+P on Mac) in DevTools
2. Type "index" to find your bundle.js or index.ts
3. Set breakpoints by clicking line numbers
4. Trigger your control's action (edit cell, click save)
5. Execution pauses at breakpoint
6. Inspect variables, step through code
```

### Network Tab - Monitor API Calls

```
1. Open Network tab
2. Filter by "XHR" or "Fetch"
3. Look for calls to:
   - /api/data/v9.2/[entityname]
   - /api/data/v9.2/$batch
4. Click a request to see:
   - Request payload
   - Response data
   - Status code
   - Headers
```

**Common API errors you'll see:**
- 400: Bad Request (invalid data format)
- 403: Forbidden (permission issues)
- 404: Not Found (wrong entity name)
- 500: Internal Server Error (Dataverse issue)

### Application Tab - Check Loaded Resources

```
1. Application tab → Frames
2. See all loaded resources
3. Verify your bundle.js loaded correctly
4. Check for 404 errors on resources
```

## React DevTools Extension

### Install React DevTools

```
Chrome: https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi

Edge: https://microsoftedge.microsoft.com/addons/detail/react-developer-tools/gpphkfbcpidddadnkolkpfckpihlkkil
```

### Using React DevTools

```
1. Open DevTools (F12)
2. Click "Components" tab (added by React DevTools)
3. Inspect your GridComponent hierarchy
4. See props and state in real-time
5. Click elements to inspect their props
6. Edit props/state live for testing
```

### Profiler Tab

```
1. Click "Profiler" tab in React DevTools
2. Click record (blue circle)
3. Interact with your grid
4. Stop recording
5. See render performance metrics
```

## Capturing Errors for Claude Code

### Method 1: Copy Console Output

**In DevTools Console:**
```
1. Right-click in console
2. "Save as..." to save entire log

Or copy specific errors:
1. Right-click error
2. "Copy message" or "Copy stack trace"
```

### Method 2: Programmatic Error Capture

**Add to your control:**

```typescript
// At the top of index.ts
const errorLog: any[] = [];

// Wrap all methods with error capture
public init(...args) {
    try {
        // Your code
    } catch (error) {
        const errorInfo = {
            method: 'init',
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            context: {
                parameters: context.parameters,
                mode: context.mode
            }
        };
        errorLog.push(errorInfo);
        console.error('[ErrorCapture]', errorInfo);
        
        // Make errorLog available globally for easy copy
        (window as any).PCFErrorLog = errorLog;
    }
}

// In console, type: copy(window.PCFErrorLog)
// Paste into Claude Code prompt
```

### Method 3: Use Monitor with Export

```
1. Use ?monitor=true in URL
2. Reproduce the issue
3. Click "Export" in Monitor
4. Save JSON file
5. Share relevant sections with Claude Code
```

## Crafting Effective Prompts for Claude Code

### Good Debugging Prompt Template

```
I'm debugging my PCF control "GridChangeTracker" deployed to Power Apps.

**Issue:**
[Describe what's not working - be specific]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Console Errors:**
```
[Paste error messages from console]
```

**Relevant Code:**
```typescript
[Paste the relevant method or component]
```

**Environment:**
- Browser: Chrome/Edge version X
- PCF version: 1.0.0
- Model-driven app

**What I've tried:**
- [List debugging steps you've taken]

**Questions:**
1. What's causing this error?
2. How do I fix it?
3. How can I prevent it in the future?
```

### Example Real Debugging Prompt

```
I'm debugging my GridChangeTracker PCF control. When I click Save, I get this error:

**Console Error:**
```
[GridChangeTracker] Save initiated
Uncaught (in promise) Error: {"error":{"code":"0x80040217","message":"You do not have permission to perform this action."}}
    at handleSave (bundle.js:234)
```

**Code:**
```typescript
private handleSave(context: ComponentFramework.Context<IInputs>): void {
    this.changedRecords.forEach((changes, recordId) => {
        const entityName = context.parameters.gridDataset.getTargetEntityType();
        context.webAPI.updateRecord(entityName, recordId, changes)
            .catch(error => console.error('Update failed:', error));
    });
}
```

**Network Tab shows:**
- POST to /api/data/v9.2/accounts(guid)
- Status: 403 Forbidden
- Response: Permission denied

**Environment:**
- User has "Basic User" role
- Entity: Account
- Fields being updated: name, revenue

What am I doing wrong? Is this a permissions issue or a code issue?
```

## Common Debugging Scenarios

### Scenario 1: Control Doesn't Appear

**Debug steps:**
```javascript
// Add to init method
console.log('[Debug] Container:', this.container);
console.log('[Debug] Container parent:', this.container.parentElement);

// Check if container has dimensions
console.log('[Debug] Container dimensions:', {
    width: this.container.offsetWidth,
    height: this.container.offsetHeight
});
```

### Scenario 2: Dataset is Empty

**Debug steps:**
```javascript
// In updateView
const dataset = context.parameters.gridDataset;
console.log('[Debug] Dataset state:', {
    loading: dataset.loading,
    error: dataset.error,
    errorMessage: dataset.errorMessage,
    sortedRecordIds: dataset.sortedRecordIds,
    recordCount: dataset.sortedRecordIds.length,
    columns: dataset.columns.map(c => ({
        name: c.name,
        dataType: c.dataType,
        isVisible: c.isVisible
    }))
});
```

### Scenario 3: Changes Not Saving

**Debug steps:**
```javascript
// In handleSave
console.log('[Debug] Changed records:', 
    JSON.stringify(Array.from(this.changedRecords.entries()), null, 2)
);

// Before each update call
console.log('[Debug] Update payload:', {
    entityName,
    recordId,
    changes,
    changeKeys: Object.keys(changes)
});

// Check WebAPI response
context.webAPI.updateRecord(entityName, recordId, changes)
    .then(response => {
        console.log('[Debug] Update successful:', response);
    })
    .catch(error => {
        console.error('[Debug] Update failed:', {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            response: error
        });
    });
```

## Performance Debugging

### Check Render Performance

```typescript
// Add to React component
React.useEffect(() => {
    console.time('[Performance] Data load');
    const records = loadRecordsFromDataset(props.dataset);
    console.timeEnd('[Performance] Data load');
}, [props.dataset]);

// Measure render time
const renderStart = performance.now();
ReactDOM.render(element, container);
console.log('[Performance] Render time:', performance.now() - renderStart, 'ms');
```

### Profile with Browser Tools

```
1. Open Performance tab in DevTools
2. Click Record
3. Interact with your control
4. Stop recording
5. Analyze flame graph for bottlenecks
```

## Quick Reference: Console Commands

```javascript
// In browser console after loading your app

// Access your control instance (if you expose it)
window.myControl

// Clear console
clear()

// Copy object to clipboard
copy(window.PCFErrorLog)

// Get all console messages
console.save = function(data, filename) {
    const blob = new Blob([data], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}

// Monitor specific function
monitor(functionName) // Logs when function is called

// Get all event listeners on element
getEventListeners(document.querySelector('.your-control'))
```

## Pro Tips

1. **Use consistent prefixes** in console.log (`[GridChangeTracker]`) for easy filtering
2. **Log both entry and exit** of critical methods
3. **Use console.group()** to organize related logs
4. **Clear console between tests** (Ctrl+L) to avoid confusion
5. **Use console.table()** for array data - much easier to read
6. **Check Network tab first** for API errors before diving into code
7. **Enable "Preserve log"** in Console settings to keep logs across page refreshes

## Final Workflow

```
1. Deploy PCF control to Power Apps
2. Open app with ?monitor=true
3. Open DevTools (F12)
4. Clear console
5. Reproduce issue
6. Copy error messages/logs
7. Check Network tab for failed requests
8. Export Monitor data if needed
9. Craft detailed prompt for Claude Code
10. Implement fix
11. Increment version in manifest
12. Rebuild and redeploy
13. Test again
```
