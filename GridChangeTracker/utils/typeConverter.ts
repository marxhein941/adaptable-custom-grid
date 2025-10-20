/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-enum-comparison, @typescript-eslint/prefer-nullish-coalescing */
/**
 * Type Converter Utility
 * Handles proper type conversion based on PCF column data types
 */

export enum ColumnDataType {
    // String types
    SingleLineText = "SingleLine.Text",
    SingleLineTextArea = "SingleLine.TextArea",
    SingleLineEmail = "SingleLine.Email",
    SingleLinePhone = "SingleLine.Phone",
    SingleLineURL = "SingleLine.URL",
    SingleLineTicker = "SingleLine.Ticker",
    Multiple = "Multiple",

    // Numeric types
    WholeNone = "Whole.None",
    Decimal = "Decimal",
    FloatingPoint = "FP",
    Currency = "Currency",

    // Date types
    DateAndTime = "DateAndTime.DateAndTime",
    DateOnly = "DateAndTime.DateOnly",

    // Other types
    TwoOptions = "TwoOptions",
    OptionSet = "OptionSet",
    Lookup = "Lookup",
    Guid = "Guid"
}

/**
 * Check if a column data type is numeric
 */
export function isNumericType(dataType: string | undefined): boolean {
    if (!dataType) return false;

    const numericTypes = [
        ColumnDataType.WholeNone,
        ColumnDataType.Decimal,
        ColumnDataType.FloatingPoint,
        ColumnDataType.Currency
    ];

    return numericTypes.includes(dataType as ColumnDataType);
}

/**
 * Check if a column data type is string-based
 */
export function isStringType(dataType: string | undefined): boolean {
    if (!dataType) return false;

    const stringTypes = [
        ColumnDataType.SingleLineText,
        ColumnDataType.SingleLineTextArea,
        ColumnDataType.SingleLineEmail,
        ColumnDataType.SingleLinePhone,
        ColumnDataType.SingleLineURL,
        ColumnDataType.SingleLineTicker,
        ColumnDataType.Multiple,
        ColumnDataType.Guid
    ];

    return stringTypes.includes(dataType as ColumnDataType);
}

/**
 * Check if a column is editable based on its data type
 */
export function isFieldEditableByType(dataType: string | undefined): boolean {
    if (!dataType) return true; // Default to editable if unknown

    // Fields that should NOT be edited directly in grid
    const nonEditableTypes = [
        ColumnDataType.Lookup,  // Lookup fields require entity reference
        ColumnDataType.Guid     // GUIDs are usually system fields
    ];

    return !nonEditableTypes.includes(dataType as ColumnDataType);
}

/**
 * Convert a value to the appropriate type based on column data type
 */
export function convertValueByDataType(
    value: any,
    dataType: string | undefined,
    columnName?: string
): any {
    // Handle null/undefined values
    if (value === null || value === undefined || value === '') {
        return null;
    }

    // If no dataType provided, try to infer from the value
    if (!dataType) {
        console.warn(`[TypeConverter] No dataType provided for column ${columnName || 'unknown'}, returning value as-is`);
        return value;
    }

    console.log(`[TypeConverter] Converting value for column ${columnName || 'unknown'} with dataType: ${dataType}`);

    // Handle numeric types
    if (isNumericType(dataType)) {
        // If already a number, return as-is
        if (typeof value === 'number') {
            console.log(`[TypeConverter] Value is already a number: ${value}`);
            return value;
        }

        // Convert string to number
        if (typeof value === 'string') {
            // Remove formatting characters
            const cleanedValue = value.replace(/[,$£€¥%]/g, '').trim();

            if (cleanedValue === '') {
                return null;
            }

            const numericValue = parseFloat(cleanedValue);

            if (isNaN(numericValue)) {
                console.warn(`[TypeConverter] Failed to convert '${value}' to number for column ${columnName}`);
                // For numeric columns, if we can't parse it, return null to avoid type errors
                return null;
            }

            // For Whole.None type, return integer
            if (dataType === ColumnDataType.WholeNone) {
                const intValue = Math.round(numericValue);
                console.log(`[TypeConverter] Converted '${value}' to integer: ${intValue}`);
                return intValue;
            }

            console.log(`[TypeConverter] Converted '${value}' to number: ${numericValue}`);
            return numericValue;
        }

        // For other types, try to convert
        const numValue = Number(value);
        if (!isNaN(numValue)) {
            return numValue;
        }

        console.warn(`[TypeConverter] Unable to convert value to number, returning null`);
        return null;
    }

    // Handle string types
    if (isStringType(dataType)) {
        // Convert to string if not already
        if (typeof value !== 'string') {
            const stringValue = String(value);
            console.log(`[TypeConverter] Converted ${typeof value} to string: '${stringValue}'`);
            return stringValue;
        }
        return value;
    }

    // Handle boolean/TwoOptions
    if (dataType === ColumnDataType.TwoOptions) {
        if (typeof value === 'boolean') {
            return value;
        }
        // Convert string representations
        if (typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            if (lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1') {
                return true;
            }
            if (lowerValue === 'false' || lowerValue === 'no' || lowerValue === '0') {
                return false;
            }
        }
        // Convert numbers
        if (typeof value === 'number') {
            return value !== 0;
        }
        return !!value;
    }

    // Handle Lookup fields - these should NOT be edited directly
    if (dataType === ColumnDataType.Lookup) {
        console.warn(`[TypeConverter] Lookup field '${columnName}' cannot be edited directly in grid. Returning null to prevent updates.`);
        // Return undefined to signal that this field should not be updated
        return undefined;
    }

    // Handle OptionSet fields - need special handling
    if (dataType === ColumnDataType.OptionSet) {
        // If it's a number, return as-is (option value)
        if (typeof value === 'number') {
            return value;
        }
        // Try to convert string to number
        if (typeof value === 'string') {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
                return numValue;
            }
        }
        console.warn(`[TypeConverter] Unable to convert OptionSet value for '${columnName}', returning null`);
        return null;
    }

    // Handle Date fields
    if (dataType === ColumnDataType.DateAndTime || dataType === ColumnDataType.DateOnly) {
        // If already a Date object or ISO string, return as-is
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (typeof value === 'string') {
            // Try to parse the date
            const dateValue = new Date(value);
            if (!isNaN(dateValue.getTime())) {
                return dateValue.toISOString();
            }
        }
        console.warn(`[TypeConverter] Unable to convert date value for '${columnName}', returning null`);
        return null;
    }

    // For all other types, return as-is
    console.log(`[TypeConverter] Unknown dataType '${dataType}' for column '${columnName}', returning value as-is`);
    return value;
}

/**
 * Extended column metadata interface
 * Based on actual PCF dataset column metadata structure
 */
export interface ExtendedColumnMetadata {
    dataType?: string;
    displayName?: string;
    isValidForUpdate?: boolean;
    isValidForCreate?: boolean;
    attributeType?: string;
    isVirtualField?: boolean; // AttributeType === "Virtual"
    isNameField?: boolean; // Logical name fields (e.g., "createdbyname")
}

/**
 * Get column metadata including data type and editability information
 * Note: Based on actual Dataverse Web API metadata structure
 */
export function getColumnMetadata(
    dataset: ComponentFramework.PropertyTypes.DataSet,
    columnName: string
): ExtendedColumnMetadata | null {
    const column = dataset.columns.find(col => col.name === columnName);

    if (!column) {
        console.warn(`[TypeConverter] Column '${columnName}' not found in dataset`);
        return null;
    }

    // Access column properties
    // Note: The actual property name might vary depending on PCF version
    const metadata = column as unknown as Record<string, unknown>;

    // Determine attribute type
    const attributeType = (metadata.attributeType as string) || (metadata.type as string) || undefined;

    // Check if this is a virtual/computed field (AttributeType === "Virtual")
    const isVirtualField = attributeType === 'Virtual';

    // Check if this is a "name" field (logical representation of lookups/owners)
    // These fields end with "name" or "yominame" and are typically not updateable
    const isNameField = columnName.endsWith('name') || columnName.endsWith('yominame');

    const extendedMetadata: ExtendedColumnMetadata = {
        dataType: (metadata.dataType as string) || attributeType,
        displayName: (metadata.displayName as string) || column.name,
        // Check if field can be updated (comes from Dataverse metadata)
        // If not explicitly set, default based on heuristics
        isValidForUpdate: metadata.isValidForUpdate !== undefined
            ? (metadata.isValidForUpdate as boolean)
            : !isVirtualField && !isNameField, // Virtual and name fields default to not updateable
        isValidForCreate: metadata.isValidForCreate as boolean | undefined,
        attributeType: attributeType,
        isVirtualField: isVirtualField,
        isNameField: isNameField
    };

    // Log metadata for debugging (only in development)
    console.log(`[TypeConverter] Metadata for '${columnName}':`, {
        dataType: extendedMetadata.dataType,
        attributeType: extendedMetadata.attributeType,
        isValidForUpdate: extendedMetadata.isValidForUpdate,
        isVirtualField: extendedMetadata.isVirtualField,
        isNameField: extendedMetadata.isNameField,
        isPrimary: column.isPrimary
    });

    return extendedMetadata;
}