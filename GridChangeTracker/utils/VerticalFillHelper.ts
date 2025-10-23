/**
 * Vertical Fill Helper Utility
 * Handles the logic for copying values vertically in the grid during drag-fill operations
 */

export class VerticalFillHelper {
    /**
     * Gets the value to fill (simply returns the source value for simple copy)
     * @param sourceValue The value from the source cell
     * @returns The value to use for filling
     */
    static getFillValue(sourceValue: any): any {
        return sourceValue;
    }

    /**
     * Generates fill values for vertical drag
     * Simply repeats the source value for the count needed
     * @param sourceValue The value to copy
     * @param count Number of cells to fill
     * @returns Array of values to fill
     */
    static generateFillValues(sourceValue: any, count: number): any[] {
        return new Array(count).fill(sourceValue);
    }

    /**
     * Validates if a value can be used for filling
     * @param value The value to validate
     * @param dataType The data type of the target column
     * @returns true if the value is valid for filling
     */
    static isValidFillValue(value: any, dataType: string): boolean {
        // Null/undefined can be filled to any cell
        if (value === null || value === undefined) {
            return true;
        }

        // Basic type validation
        switch (dataType) {
            case 'Whole.None':
            case 'Decimal':
            case 'Currency':
                return !isNaN(Number(value));

            case 'TwoOptions':
                return typeof value === 'boolean';

            case 'DateAndTime.DateOnly':
            case 'DateAndTime.DateAndTime':
                // Accept Date objects or valid date strings
                return value instanceof Date || !isNaN(Date.parse(value));

            default:
                // For text and other types, any value is valid
                return true;
        }
    }

    /**
     * Determines the fill direction based on start and end positions
     * @param startRow Starting row index
     * @param endRow Ending row index
     * @returns 'up' or 'down'
     */
    static getFillDirection(startRow: number, endRow: number): 'up' | 'down' {
        return startRow < endRow ? 'down' : 'up';
    }

    /**
     * Calculates the range of cells to fill (excluding the source cell)
     * @param anchorRow The row index of the anchor/source cell
     * @param targetRow The row index where the drag ended
     * @returns Object with startRow and endRow for filling
     */
    static calculateFillRange(anchorRow: number, targetRow: number): { startRow: number; endRow: number; excludeAnchor: boolean } {
        if (anchorRow === targetRow) {
            // No fill needed if dragging to same cell
            return { startRow: anchorRow, endRow: anchorRow, excludeAnchor: true };
        }

        const startRow = Math.min(anchorRow, targetRow);
        const endRow = Math.max(anchorRow, targetRow);

        return { startRow, endRow, excludeAnchor: true };
    }
}