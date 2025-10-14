/**
 * Aggregation Utility
 * Provides calculation functions for grid data aggregations
 */

export enum AggregationMode {
    None = 0,
    Sum = 1,
    Average = 2,
    Count = 3
}

export interface AggregationResult {
    [columnName: string]: {
        value: number;
        formattedValue: string;
        mode: AggregationMode;
    };
}

/**
 * Calculate aggregations for all columns in the dataset
 */
export function calculateAggregations(
    data: any[],
    columns: ComponentFramework.PropertyHelper.DataSetApi.Column[],
    mode: AggregationMode
): AggregationResult {
    const result: AggregationResult = {};

    if (mode === AggregationMode.None || !data || data.length === 0) {
        return result;
    }

    columns.forEach(column => {
        const columnName = column.name;
        const values = extractNumericValues(data, columnName);

        if (values.length > 0) {
            let calculatedValue: number;

            switch (mode) {
                case AggregationMode.Sum:
                    calculatedValue = calculateSum(values);
                    break;
                case AggregationMode.Average:
                    calculatedValue = calculateAverage(values);
                    break;
                case AggregationMode.Count:
                    calculatedValue = data.length;
                    break;
                default:
                    calculatedValue = 0;
            }

            result[columnName] = {
                value: calculatedValue,
                formattedValue: formatAggregationValue(calculatedValue, mode),
                mode: mode
            };
        }
    });

    return result;
}

/**
 * Extract numeric values from a column
 */
function extractNumericValues(data: any[], columnName: string): number[] {
    const values: number[] = [];

    data.forEach(record => {
        const value = record[columnName];

        if (value != null) {
            // Try to convert to number
            const numValue = typeof value === 'number' ? value : parseFloat(value);

            if (!isNaN(numValue) && isFinite(numValue)) {
                values.push(numValue);
            }
        }
    });

    return values;
}

/**
 * Calculate sum of values
 */
function calculateSum(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0);
}

/**
 * Calculate average of values
 */
function calculateAverage(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    return calculateSum(values) / values.length;
}

/**
 * Format aggregation value for display
 */
function formatAggregationValue(value: number, mode: AggregationMode): string {
    switch (mode) {
        case AggregationMode.Sum:
            return `Sum: ${formatNumber(value)}`;
        case AggregationMode.Average:
            return `Avg: ${formatNumber(value)}`;
        case AggregationMode.Count:
            return `Count: ${value}`;
        default:
            return '';
    }
}

/**
 * Format number with appropriate decimal places
 */
function formatNumber(value: number): string {
    // Check if it's a whole number
    if (Number.isInteger(value)) {
        return value.toLocaleString();
    }

    // Format with 2 decimal places
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Get aggregation mode from enum value
 */
export function getAggregationMode(value: number | null | undefined): AggregationMode {
    if (value == null) {
        return AggregationMode.None;
    }

    switch (value) {
        case 0:
            return AggregationMode.None;
        case 1:
            return AggregationMode.Sum;
        case 2:
            return AggregationMode.Average;
        case 3:
            return AggregationMode.Count;
        default:
            return AggregationMode.None;
    }
}

/**
 * Get aggregation mode display name
 */
export function getAggregationModeName(mode: AggregationMode): string {
    switch (mode) {
        case AggregationMode.None:
            return 'None';
        case AggregationMode.Sum:
            return 'Sum';
        case AggregationMode.Average:
            return 'Average';
        case AggregationMode.Count:
            return 'Count';
        default:
            return 'None';
    }
}

/**
 * Check if a column is numeric
 */
export function isNumericColumn(data: any[], columnName: string): boolean {
    if (!data || data.length === 0) {
        return false;
    }

    // Sample first few non-null values
    const sampleSize = Math.min(5, data.length);
    let numericCount = 0;

    for (let i = 0; i < data.length && numericCount < sampleSize; i++) {
        const value = data[i][columnName];

        if (value != null) {
            const numValue = typeof value === 'number' ? value : parseFloat(value);
            if (!isNaN(numValue) && isFinite(numValue)) {
                numericCount++;
            } else {
                // Found a non-numeric value
                return false;
            }
        }
    }

    return numericCount > 0;
}
