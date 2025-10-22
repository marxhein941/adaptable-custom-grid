# GridChangeTracker - Read-Only Fields Debugging Guide

## Summary of Logging Enhancements

I've enhanced the logging system in the GridChangeTracker component to help debug the read-only fields configuration issue. The improvements include:

### 1. **Centralized Logger System** (`utils/logger.ts`)
- Structured logging with tags for easy filtering
- Different log levels (DEBUG, INFO, WARN, ERROR, CRITICAL)
- Context-aware logging with automatic formatting
- Enable/disable specific tags for focused debugging

### 2. **Enhanced Read-Only Field Logging**
Key areas with improved logging:

#### **Initialization** (`index.ts`)
```typescript
[GridChangeTracker][INIT] Starting initialization...
[GridChangeTracker][READONLY] Read-only fields configured at initialization
  rawValue: "opalcrm_LastYearActSQM,opalcrm_LastYearActRatePerSQM,..."
  length: 150
```

#### **Field Parsing** (`GridComponent.tsx`)
```typescript
[GridChangeTracker][READONLY] Raw read-only fields input
  raw: "opalcrm_LastYearActSQM,opalcrm_LastYearActRatePerSQM,..."
  length: 150
[GridChangeTracker][READONLY] Parsed 5 read-only fields
  fields: ["opalcrm_LastYearActSQM", "opalcrm_LastYearActRatePerSQM", ...]
```

#### **Editability Checks** (`GridComponent.tsx`)
```typescript
[GridChangeTracker][EDITABLE] Field 'opalcrm_LastYearActSQM' editability: false
  field: opalcrm_LastYearActSQM
  editable: false
  reason: Field is in read-only configuration list
```

### 3. **Debug HTML Tool** (`debug-readonly.html`)
Open this file in your browser to:
- Enable/disable debug mode
- Set specific debug tags
- View current localStorage settings
- Get instructions on what to look for in console logs

## How to Debug the Read-Only Issue

### Step 1: Enable Debug Logging
1. Open `debug-readonly.html` in the same browser as your Power Apps
2. Click "Enable Read-Only Debug Only" button
3. Refresh your Power Apps page

### Step 2: Check the Console
Open Developer Tools (F12) and look for these key log entries:

1. **Verify fields are being passed correctly:**
   ```
   [GridChangeTracker][READONLY] Read-only fields configured at initialization
   ```
   - Check if the `rawValue` contains your expected fields
   - Verify the field names match exactly (no extra spaces)

2. **Confirm parsing is working:**
   ```
   [GridChangeTracker][READONLY] Parsed X read-only fields
   ```
   - Verify the correct number of fields are parsed
   - Check the field array contains the expected field names

3. **Check each field's editability:**
   ```
   [GridChangeTracker][EDITABLE] Field 'fieldname' editability: true/false
   ```
   - Look for your specific fields
   - Check the `reason` if a field is not being marked as read-only

### Step 3: Common Issues to Check

#### 1. **Field Name Mismatch**
- The field names in your configuration must EXACTLY match the column names in the dataset
- Check for:
  - Extra spaces before/after field names
  - Case sensitivity issues
  - Typos in field names

#### 2. **Column Not in View**
- The field must be present in the grid view
- Check available columns with:
  ```
  [GridChangeTracker][COLUMNS] Available columns in dataset
  ```

#### 3. **Configuration Not Being Passed**
- Verify the `readOnlyFields` parameter is configured in your PCF control
- Check if the value is being passed in the init and updateView methods

#### 4. **Parsing Issues**
- The component splits fields by comma, newline, or carriage return
- Ensure your field list doesn't have unexpected characters

### Step 4: Test Scenarios

1. **Test with a single field first:**
   - Configure just one field as read-only: `opalcrm_LastYearActSQM`
   - Check if that single field becomes read-only

2. **Check field name format:**
   - Try with and without spaces: `field1,field2` vs `field1, field2`
   - The component should handle both, but verify which works

3. **Verify in the UI:**
   - Read-only fields should have:
     - Gray background (#f3f2f1)
     - "not-allowed" cursor
     - Italic text
     - Tooltip showing why it's read-only

## Log Tags Reference

| Tag | Purpose |
|-----|---------|
| `[INIT]` | Component initialization |
| `[UPDATE]` | UpdateView calls |
| `[READONLY]` | Read-only field configuration and parsing |
| `[EDITABLE]` | Field editability checks |
| `[RENDER]` | Cell rendering |
| `[COLUMNS]` | Column metadata |
| `[METADATA]` | Entity metadata loading |
| `[DATASET]` | Dataset operations |
| `[PAGING]` | Pagination operations |
| `[SAVE]` | Save operations |
| `[CHANGE]` | Cell value changes |

## Quick Troubleshooting Commands

In the browser console, you can run:

```javascript
// Check current debug settings
localStorage.getItem('gridTrackerDebug')
localStorage.getItem('gridTrackerDebugTags')

// Enable all debug logging
localStorage.setItem('gridTrackerDebug', 'true')

// Enable only read-only debugging
localStorage.setItem('gridTrackerDebugTags', 'READONLY,EDITABLE')

// Clear all debug settings
localStorage.removeItem('gridTrackerDebug')
localStorage.removeItem('gridTrackerDebugTags')
```

## Next Steps

1. Use the debug tools to identify why your fields aren't being marked as read-only
2. Look for the specific reason in the logs
3. Common fixes:
   - Ensure field names match exactly
   - Remove any extra whitespace
   - Verify fields are in the grid view
   - Check the PCF control configuration

The enhanced logging should clearly show where the issue is occurring in the read-only field processing pipeline.