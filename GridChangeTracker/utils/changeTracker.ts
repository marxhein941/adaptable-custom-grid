/**
 * Change Tracker Utility
 * Tracks changes to cell values and maintains a map of modifications
 */

export interface CellChange {
    recordId: string;
    columnName: string;
    originalValue: any;
    newValue: any;
    timestamp: Date;
}

export interface ChangeMap {
    [key: string]: { [columnName: string]: any };
}

export class ChangeTracker {
    private originalData: Map<string, any>;
    private changedCells: Set<string>;
    private changes: ChangeMap;

    constructor() {
        this.originalData = new Map();
        this.changedCells = new Set();
        this.changes = {};
    }

    /**
     * Initialize the tracker with original data
     */
    public initializeData(records: any[]): void {
        this.originalData.clear();
        this.changedCells.clear();
        this.changes = {};

        records.forEach(record => {
            this.originalData.set(record.id, { ...record });
        });
    }

    /**
     * Track a cell change
     */
    public trackChange(recordId: string, columnName: string, newValue: any): boolean {
        const original = this.originalData.get(recordId);

        if (!original) {
            console.warn(`Record ${recordId} not found in original data`);
            return false;
        }

        const originalValue = original[columnName];
        const cellKey = this.getCellKey(recordId, columnName);

        // Check if value changed from original
        if (this.valuesAreEqual(originalValue, newValue)) {
            // Value reverted to original - remove from changes
            this.changedCells.delete(cellKey);
            if (this.changes[recordId]) {
                delete this.changes[recordId][columnName];
                if (Object.keys(this.changes[recordId]).length === 0) {
                    delete this.changes[recordId];
                }
            }
            return false;
        } else {
            // Value is different - track the change
            this.changedCells.add(cellKey);
            if (!this.changes[recordId]) {
                this.changes[recordId] = {};
            }
            this.changes[recordId][columnName] = newValue;
            return true;
        }
    }

    /**
     * Check if a cell has changed
     */
    public isCellChanged(recordId: string, columnName: string): boolean {
        const cellKey = this.getCellKey(recordId, columnName);
        return this.changedCells.has(cellKey);
    }

    /**
     * Get all changes
     */
    public getChanges(): ChangeMap {
        return { ...this.changes };
    }

    /**
     * Get changed records count
     */
    public getChangedRecordsCount(): number {
        return Object.keys(this.changes).length;
    }

    /**
     * Get total changed cells count
     */
    public getChangedCellsCount(): number {
        return this.changedCells.size;
    }

    /**
     * Clear all changes
     */
    public clearChanges(): void {
        this.changedCells.clear();
        this.changes = {};
    }

    /**
     * Reset tracker with new original data
     */
    public reset(records: any[]): void {
        this.initializeData(records);
    }

    /**
     * Get original value for a cell
     */
    public getOriginalValue(recordId: string, columnName: string): any {
        const original = this.originalData.get(recordId);
        return original ? original[columnName] : undefined;
    }

    /**
     * Helper to generate cell key
     */
    private getCellKey(recordId: string, columnName: string): string {
        return `${recordId}_${columnName}`;
    }

    /**
     * Compare values for equality
     */
    private valuesAreEqual(value1: any, value2: any): boolean {
        // Handle null/undefined
        if (value1 == null && value2 == null) {
            return true;
        }
        if (value1 == null || value2 == null) {
            return false;
        }

        // Handle numbers
        if (typeof value1 === 'number' && typeof value2 === 'number') {
            return value1 === value2;
        }

        // Handle strings (trim whitespace for comparison)
        if (typeof value1 === 'string' && typeof value2 === 'string') {
            return value1.trim() === value2.trim();
        }

        // Handle dates
        if (value1 instanceof Date && value2 instanceof Date) {
            return value1.getTime() === value2.getTime();
        }

        // Default comparison
        return value1 === value2;
    }

    /**
     * Export change history (for debugging/logging)
     */
    public exportChangeHistory(): CellChange[] {
        const history: CellChange[] = [];

        Object.keys(this.changes).forEach(recordId => {
            Object.keys(this.changes[recordId]).forEach(columnName => {
                history.push({
                    recordId,
                    columnName,
                    originalValue: this.getOriginalValue(recordId, columnName),
                    newValue: this.changes[recordId][columnName],
                    timestamp: new Date()
                });
            });
        });

        return history;
    }
}
