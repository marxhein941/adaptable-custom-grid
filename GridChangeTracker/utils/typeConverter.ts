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

    // For all other types, return as-is
    console.log(`[TypeConverter] Unknown dataType '${dataType}', returning value as-is`);
    return value;
}

/**
 * Get column metadata including data type
 */
export function getColumnMetadata(
    dataset: ComponentFramework.PropertyTypes.DataSet,
    columnName: string
): { dataType?: string; displayName?: string } | null {
    const column = dataset.columns.find(col => col.name === columnName);

    if (!column) {
        console.warn(`[TypeConverter] Column '${columnName}' not found in dataset`);
        return null;
    }

    // Access column properties
    // Note: The actual property name might vary depending on PCF version
    const metadata = column as unknown as Record<string, unknown>;

    return {
        dataType: (metadata.dataType as string) || (metadata.type as string) || undefined,
        displayName: (metadata.displayName as string) || column.name
    };
}