/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/array-type, @typescript-eslint/no-inferrable-types, @typescript-eslint/consistent-generic-constructors, @typescript-eslint/require-await, no-case-declarations, prefer-const */
/**
 * Excel Clipboard Handler
 * Enables copying and pasting data between Excel and the grid
 */

export interface ClipboardData {
    text: string;
    html?: string;
    cells: string[][];
}

export class ExcelClipboardHandler {
    /**
     * Parse clipboard data from Excel/CSV format
     */
    public static parseClipboardData(clipboardText: string): string[][] {
        if (!clipboardText) return [];

        // Split by line breaks (handles Windows, Mac, Linux)
        const rows = clipboardText.split(/\r?\n/).filter(row => row.length > 0);

        // Split each row by tab (Excel uses tabs)
        return rows.map(row => row.split('\t'));
    }

    /**
     * Format grid data for Excel clipboard
     */
    public static formatForExcel(data: any[][], columns: string[]): string {
        // Add header row
        const headerRow = columns.join('\t');

        // Format data rows
        const dataRows = data.map(row =>
            columns.map(col => {
                const value = (row as any)[col];
                // Handle special characters and formatting
                if (value === null || value === undefined) return '';
                if (typeof value === 'string' && value.includes('\t')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return String(value);
            }).join('\t')
        );

        return [headerRow, ...dataRows].join('\r\n');
    }

    /**
     * Parse HTML table data from clipboard (rich Excel copy)
     */
    public static parseHtmlTable(html: string): string[][] {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const table = doc.querySelector('table');

        if (!table) return [];

        const rows: string[][] = [];
        const tableRows = table.querySelectorAll('tr');

        tableRows.forEach(tr => {
            const cells: string[] = [];
            tr.querySelectorAll('td, th').forEach(cell => {
                cells.push((cell.textContent || '').trim());
            });
            if (cells.length > 0) {
                rows.push(cells);
            }
        });

        return rows;
    }

    /**
     * Smart paste - maps clipboard columns to grid columns
     */
    public static smartPaste(
        clipboardData: string[][],
        gridColumns: Array<{name: string, displayName: string}>,
        startRowIndex: number,
        startColIndex: number
    ): Array<{rowIndex: number, columnName: string, value: string}> {
        const updates: Array<{rowIndex: number, columnName: string, value: string}> = [];

        // Check if first row might be headers
        const firstRow = clipboardData[0];
        let dataStartRow = 0;
        let columnMapping: number[] = [];

        // Try to detect if first row is headers
        const isFirstRowHeader = firstRow.every(cell =>
            gridColumns.some(col =>
                col.displayName.toLowerCase() === cell.toLowerCase() ||
                col.name.toLowerCase() === cell.toLowerCase()
            )
        );

        if (isFirstRowHeader) {
            // Map clipboard columns to grid columns
            dataStartRow = 1;
            firstRow.forEach((header, index) => {
                const gridColIndex = gridColumns.findIndex(col =>
                    col.displayName.toLowerCase() === header.toLowerCase() ||
                    col.name.toLowerCase() === header.toLowerCase()
                );
                columnMapping[index] = gridColIndex;
            });
        } else {
            // Direct column mapping based on position
            for (let i = 0; i < firstRow.length; i++) {
                if (startColIndex + i < gridColumns.length) {
                    columnMapping[i] = startColIndex + i;
                }
            }
        }

        // Process data rows
        for (let rowIdx = dataStartRow; rowIdx < clipboardData.length; rowIdx++) {
            const row = clipboardData[rowIdx];
            const targetRowIndex = startRowIndex + (rowIdx - dataStartRow);

            row.forEach((value, colIdx) => {
                const targetColIndex = columnMapping[colIdx];
                if (targetColIndex >= 0 && targetColIndex < gridColumns.length) {
                    updates.push({
                        rowIndex: targetRowIndex,
                        columnName: gridColumns[targetColIndex].name,
                        value: value
                    });
                }
            });
        }

        return updates;
    }

    /**
     * Handle paste event
     */
    public static async handlePaste(event: ClipboardEvent): Promise<ClipboardData> {
        event.preventDefault();

        const clipboardData = event.clipboardData;
        if (!clipboardData) {
            throw new Error('No clipboard data available');
        }

        const text = clipboardData.getData('text/plain');
        const html = clipboardData.getData('text/html');

        let cells: string[][];

        // Try HTML first (richer format from Excel)
        if (html) {
            cells = this.parseHtmlTable(html);
        } else {
            cells = this.parseClipboardData(text);
        }

        return {
            text,
            html,
            cells
        };
    }

    /**
     * Handle copy event
     */
    public static handleCopy(event: ClipboardEvent, selectedData: any[][], columns: string[]): void {
        event.preventDefault();

        const clipboardData = event.clipboardData;
        if (!clipboardData) return;

        const text = this.formatForExcel(selectedData, columns);
        clipboardData.setData('text/plain', text);

        // Also set HTML format for rich copy
        const html = this.formatAsHtmlTable(selectedData, columns);
        clipboardData.setData('text/html', html);
    }

    /**
     * Format data as HTML table
     */
    private static formatAsHtmlTable(data: any[][], columns: string[]): string {
        const headerRow = `<tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>`;
        const dataRows = data.map(row =>
            `<tr>${columns.map(col => `<td>${(row as any)[col] || ''}</td>`).join('')}</tr>`
        ).join('');

        return `<table>${headerRow}${dataRows}</table>`;
    }

    /**
     * Validate pasted data against column types
     */
    public static validatePastedData(
        updates: Array<{columnName: string, value: string}>,
        columnTypes: Map<string, string>
    ): Array<{columnName: string, value: any, isValid: boolean, error?: string}> {
        return updates.map(update => {
            const columnType = columnTypes.get(update.columnName) || 'string';
            const validation = this.validateValue(update.value, columnType);

            return {
                columnName: update.columnName,
                value: validation.convertedValue,
                isValid: validation.isValid,
                error: validation.error
            };
        });
    }

    private static validateValue(value: string, type: string): {
        isValid: boolean;
        convertedValue: any;
        error?: string;
    } {
        try {
            switch (type) {
                case 'number':
                case 'decimal':
                case 'float':
                case 'money':
                case 'currency':
                    const num = parseFloat(value.replace(/[$,]/g, ''));
                    if (isNaN(num)) {
                        return {isValid: false, convertedValue: value, error: 'Invalid number'};
                    }
                    return {isValid: true, convertedValue: num};

                case 'boolean':
                case 'bit':
                    const bool = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
                    return {isValid: true, convertedValue: bool};

                case 'date':
                case 'datetime':
                    const date = new Date(value);
                    if (isNaN(date.getTime())) {
                        return {isValid: false, convertedValue: value, error: 'Invalid date'};
                    }
                    return {isValid: true, convertedValue: date.toISOString()};

                default:
                    return {isValid: true, convertedValue: value};
            }
        } catch (error) {
            return {isValid: false, convertedValue: value, error: String(error)};
        }
    }
}
