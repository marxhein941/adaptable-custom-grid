/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/array-type, @typescript-eslint/no-inferrable-types, @typescript-eslint/consistent-generic-constructors, @typescript-eslint/require-await, no-case-declarations, prefer-const */
/**
 * Command Pattern Implementation for Undo/Redo functionality
 * Provides multi-level undo/redo with command history
 */

export interface ICommand {
    execute(): Promise<void> | void;
    undo(): Promise<void> | void;
    redo(): Promise<void> | void;
    description: string;
    timestamp: Date;
    canMerge?(other: ICommand): boolean;
    merge?(other: ICommand): void;
}

export abstract class BaseCommand implements ICommand {
    public description: string;
    public timestamp: Date;

    constructor(description: string) {
        this.description = description;
        this.timestamp = new Date();
    }

    abstract execute(): Promise<void> | void;
    abstract undo(): Promise<void> | void;

    redo(): Promise<void> | void {
        return this.execute();
    }

    canMerge(other: ICommand): boolean {
        return false;
    }
}

/**
 * Command for cell value changes
 */
export class CellEditCommand extends BaseCommand {
    private recordId: string;
    private columnName: string;
    private oldValue: any;
    private newValue: any;
    private onExecute: (recordId: string, columnName: string, value: any) => void;

    constructor(
        recordId: string,
        columnName: string,
        oldValue: any,
        newValue: any,
        onExecute: (recordId: string, columnName: string, value: any) => void
    ) {
        super(`Edit cell ${columnName}`);
        this.recordId = recordId;
        this.columnName = columnName;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.onExecute = onExecute;
    }

    execute(): void {
        this.onExecute(this.recordId, this.columnName, this.newValue);
    }

    undo(): void {
        this.onExecute(this.recordId, this.columnName, this.oldValue);
    }

    canMerge(other: ICommand): boolean {
        if (!(other instanceof CellEditCommand)) return false;

        // Merge if same cell edited within 2 seconds
        const timeDiff = Math.abs(this.timestamp.getTime() - other.timestamp.getTime());
        return this.recordId === other.recordId &&
               this.columnName === other.columnName &&
               timeDiff < 2000;
    }

    merge(other: ICommand): void {
        if (other instanceof CellEditCommand) {
            this.newValue = other.newValue;
            this.timestamp = other.timestamp;
            this.description = `Edit cell ${this.columnName}`;
        }
    }
}

/**
 * Command for bulk edits
 */
export class BulkEditCommand extends BaseCommand {
    private changes: Array<{
        recordId: string;
        columnName: string;
        oldValue: any;
        newValue: any;
    }>;
    private onExecute: (recordId: string, columnName: string, value: any) => void;

    constructor(
        changes: Array<{recordId: string; columnName: string; oldValue: any; newValue: any}>,
        onExecute: (recordId: string, columnName: string, value: any) => void
    ) {
        super(`Bulk edit ${changes.length} cells`);
        this.changes = changes;
        this.onExecute = onExecute;
    }

    execute(): void {
        this.changes.forEach(change => {
            this.onExecute(change.recordId, change.columnName, change.newValue);
        });
    }

    undo(): void {
        // Undo in reverse order
        for (let i = this.changes.length - 1; i >= 0; i--) {
            const change = this.changes[i];
            this.onExecute(change.recordId, change.columnName, change.oldValue);
        }
    }
}

/**
 * Command History Manager
 */
export class CommandHistory {
    private history: ICommand[] = [];
    private currentIndex: number = -1;
    private maxHistorySize: number;
    private isExecuting: boolean = false;

    constructor(maxHistorySize: number = 100) {
        this.maxHistorySize = maxHistorySize;
    }

    /**
     * Execute a new command and add to history
     */
    public async execute(command: ICommand): Promise<void> {
        if (this.isExecuting) return;

        this.isExecuting = true;

        try {
            // Execute the command
            await command.execute();

            // Check if we can merge with the last command
            if (this.currentIndex >= 0) {
                const lastCommand = this.history[this.currentIndex];
                if (lastCommand.canMerge && lastCommand.canMerge(command)) {
                    lastCommand.merge!(command);
                    this.isExecuting = false;
                    return;
                }
            }

            // Remove any commands after current index (branching)
            if (this.currentIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.currentIndex + 1);
            }

            // Add new command
            this.history.push(command);
            this.currentIndex++;

            // Limit history size
            if (this.history.length > this.maxHistorySize) {
                const overflow = this.history.length - this.maxHistorySize;
                this.history = this.history.slice(overflow);
                this.currentIndex -= overflow;
            }
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Undo the last command
     */
    public async undo(): Promise<boolean> {
        if (this.isExecuting || !this.canUndo()) return false;

        this.isExecuting = true;

        try {
            const command = this.history[this.currentIndex];
            await command.undo();
            this.currentIndex--;
            return true;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Redo the next command
     */
    public async redo(): Promise<boolean> {
        if (this.isExecuting || !this.canRedo()) return false;

        this.isExecuting = true;

        try {
            this.currentIndex++;
            const command = this.history[this.currentIndex];
            await command.redo();
            return true;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Check if undo is available
     */
    public canUndo(): boolean {
        return this.currentIndex >= 0;
    }

    /**
     * Check if redo is available
     */
    public canRedo(): boolean {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Get undo/redo status
     */
    public getStatus(): {
        canUndo: boolean;
        canRedo: boolean;
        undoDescription?: string;
        redoDescription?: string;
        historySize: number;
    } {
        return {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            undoDescription: this.canUndo() ? this.history[this.currentIndex].description : undefined,
            redoDescription: this.canRedo() ? this.history[this.currentIndex + 1].description : undefined,
            historySize: this.history.length
        };
    }

    /**
     * Clear all history
     */
    public clear(): void {
        this.history = [];
        this.currentIndex = -1;
    }

    /**
     * Get history for display
     */
    public getHistory(): Array<{
        description: string;
        timestamp: Date;
        isCurrent: boolean;
    }> {
        return this.history.map((cmd, index) => ({
            description: cmd.description,
            timestamp: cmd.timestamp,
            isCurrent: index === this.currentIndex
        }));
    }

    /**
     * Create a batch command from multiple commands
     */
    public static createBatch(commands: ICommand[], description: string): ICommand {
        return new BatchCommand(commands, description);
    }
}

/**
 * Batch command for grouping multiple commands
 */
class BatchCommand extends BaseCommand {
    private commands: ICommand[];

    constructor(commands: ICommand[], description: string) {
        super(description);
        this.commands = commands;
    }

    async execute(): Promise<void> {
        for (const command of this.commands) {
            await command.execute();
        }
    }

    async undo(): Promise<void> {
        // Undo in reverse order
        for (let i = this.commands.length - 1; i >= 0; i--) {
            await this.commands[i].undo();
        }
    }
}
