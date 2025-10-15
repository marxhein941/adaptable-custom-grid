/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/array-type, @typescript-eslint/no-inferrable-types, @typescript-eslint/consistent-generic-constructors, @typescript-eslint/require-await, no-case-declarations, prefer-const */
/**
 * Keyboard Shortcuts Manager
 * Provides Excel-like keyboard navigation and shortcuts
 */

export interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    description: string;
    action: () => void | Promise<void>;
    enabled?: boolean;
}

export class KeyboardShortcutManager {
    private shortcuts: Map<string, KeyboardShortcut> = new Map();
    private isEnabled: boolean = true;
    private activeElement: HTMLElement | null = null;

    constructor() {
        this.initializeDefaultShortcuts();
    }

    /**
     * Initialize default Excel-like shortcuts
     */
    private initializeDefaultShortcuts(): void {
        // Navigation shortcuts
        this.register({
            key: 'ArrowUp',
            description: 'Move up',
            action: () => this.navigate('up')
        });

        this.register({
            key: 'ArrowDown',
            description: 'Move down',
            action: () => this.navigate('down')
        });

        this.register({
            key: 'ArrowLeft',
            description: 'Move left',
            action: () => this.navigate('left')
        });

        this.register({
            key: 'ArrowRight',
            description: 'Move right',
            action: () => this.navigate('right')
        });

        this.register({
            key: 'Tab',
            description: 'Move to next cell',
            action: () => this.navigate('next')
        });

        this.register({
            key: 'Tab',
            shift: true,
            description: 'Move to previous cell',
            action: () => this.navigate('previous')
        });

        this.register({
            key: 'Enter',
            description: 'Move down and edit',
            action: () => this.navigate('down', true)
        });

        this.register({
            key: 'Home',
            description: 'Move to first column',
            action: () => this.navigate('home')
        });

        this.register({
            key: 'End',
            description: 'Move to last column',
            action: () => this.navigate('end')
        });

        this.register({
            key: 'Home',
            ctrl: true,
            description: 'Move to first cell',
            action: () => this.navigate('first')
        });

        this.register({
            key: 'End',
            ctrl: true,
            description: 'Move to last cell',
            action: () => this.navigate('last')
        });

        // Selection shortcuts
        this.register({
            key: 'a',
            ctrl: true,
            description: 'Select all',
            action: () => this.selectAll()
        });

        this.register({
            key: ' ',
            shift: true,
            description: 'Select row',
            action: () => this.selectRow()
        });

        this.register({
            key: ' ',
            ctrl: true,
            description: 'Select column',
            action: () => this.selectColumn()
        });

        // Edit shortcuts
        this.register({
            key: 'F2',
            description: 'Edit cell',
            action: () => this.editCell()
        });

        this.register({
            key: 'Delete',
            description: 'Clear cell',
            action: () => this.clearCell()
        });

        this.register({
            key: 'Backspace',
            description: 'Clear and edit',
            action: () => this.clearAndEdit()
        });

        // Clipboard shortcuts
        this.register({
            key: 'c',
            ctrl: true,
            description: 'Copy',
            action: () => this.copy()
        });

        this.register({
            key: 'x',
            ctrl: true,
            description: 'Cut',
            action: () => this.cut()
        });

        this.register({
            key: 'v',
            ctrl: true,
            description: 'Paste',
            action: () => this.paste()
        });

        // Undo/Redo
        this.register({
            key: 'z',
            ctrl: true,
            description: 'Undo',
            action: () => this.undo()
        });

        this.register({
            key: 'y',
            ctrl: true,
            description: 'Redo',
            action: () => this.redo()
        });

        this.register({
            key: 'z',
            ctrl: true,
            shift: true,
            description: 'Redo',
            action: () => this.redo()
        });

        // Find/Replace
        this.register({
            key: 'f',
            ctrl: true,
            description: 'Find',
            action: () => this.find()
        });

        this.register({
            key: 'h',
            ctrl: true,
            description: 'Replace',
            action: () => this.replace()
        });

        // Save
        this.register({
            key: 's',
            ctrl: true,
            description: 'Save',
            action: () => this.save()
        });

        // Fill operations
        this.register({
            key: 'd',
            ctrl: true,
            description: 'Fill down',
            action: () => this.fillDown()
        });

        this.register({
            key: 'r',
            ctrl: true,
            description: 'Fill right',
            action: () => this.fillRight()
        });
    }

    /**
     * Register a keyboard shortcut
     */
    public register(shortcut: KeyboardShortcut): void {
        const key = this.getShortcutKey(shortcut);
        this.shortcuts.set(key, shortcut);
    }

    /**
     * Unregister a keyboard shortcut
     */
    public unregister(shortcut: KeyboardShortcut): void {
        const key = this.getShortcutKey(shortcut);
        this.shortcuts.delete(key);
    }

    /**
     * Get shortcut key string
     */
    private getShortcutKey(shortcut: KeyboardShortcut): string {
        const parts: string[] = [];
        if (shortcut.ctrl) parts.push('Ctrl');
        if (shortcut.alt) parts.push('Alt');
        if (shortcut.shift) parts.push('Shift');
        parts.push(shortcut.key);
        return parts.join('+');
    }

    /**
     * Handle keyboard event
     */
    public handleKeyDown(event: KeyboardEvent): boolean {
        if (!this.isEnabled) return false;

        const shortcutKey = this.getEventKey(event);
        const shortcut = this.shortcuts.get(shortcutKey);

        if (shortcut && (shortcut.enabled !== false)) {
            event.preventDefault();
            event.stopPropagation();

            // Execute action
            Promise.resolve(shortcut.action()).catch(error => {
                console.error(`Error executing shortcut ${shortcutKey}:`, error);
            });

            return true;
        }

        return false;
    }

    /**
     * Get event key string
     */
    private getEventKey(event: KeyboardEvent): string {
        const parts: string[] = [];
        if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        parts.push(event.key);
        return parts.join('+');
    }

    /**
     * Enable/disable shortcuts
     */
    public setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    /**
     * Get all registered shortcuts
     */
    public getShortcuts(): KeyboardShortcut[] {
        return Array.from(this.shortcuts.values());
    }

    /**
     * Get shortcuts by category
     */
    public getShortcutsByCategory(): Map<string, KeyboardShortcut[]> {
        const categories = new Map<string, KeyboardShortcut[]>();

        const categorize = (shortcut: KeyboardShortcut): string => {
            if (shortcut.description.includes('Move') || shortcut.description.includes('Navigate')) {
                return 'Navigation';
            } else if (shortcut.description.includes('Select')) {
                return 'Selection';
            } else if (shortcut.description.includes('Edit') || shortcut.description.includes('Clear')) {
                return 'Editing';
            } else if (shortcut.description.includes('Copy') || shortcut.description.includes('Paste')) {
                return 'Clipboard';
            } else if (shortcut.description.includes('Undo') || shortcut.description.includes('Redo')) {
                return 'History';
            } else if (shortcut.description.includes('Find') || shortcut.description.includes('Replace')) {
                return 'Search';
            } else if (shortcut.description.includes('Fill')) {
                return 'Fill';
            } else {
                return 'Other';
            }
        };

        this.shortcuts.forEach(shortcut => {
            const category = categorize(shortcut);
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category)!.push(shortcut);
        });

        return categories;
    }

    // Navigation actions (to be implemented by the grid)
    private navigate(direction: string, edit?: boolean): void {
        // This will be overridden by the grid implementation
        console.log(`Navigate ${direction}${edit ? ' and edit' : ''}`);
    }

    private selectAll(): void {
        console.log('Select all');
    }

    private selectRow(): void {
        console.log('Select row');
    }

    private selectColumn(): void {
        console.log('Select column');
    }

    private editCell(): void {
        console.log('Edit cell');
    }

    private clearCell(): void {
        console.log('Clear cell');
    }

    private clearAndEdit(): void {
        console.log('Clear and edit');
    }

    private copy(): void {
        console.log('Copy');
    }

    private cut(): void {
        console.log('Cut');
    }

    private paste(): void {
        console.log('Paste');
    }

    private undo(): void {
        console.log('Undo');
    }

    private redo(): void {
        console.log('Redo');
    }

    private find(): void {
        console.log('Find');
    }

    private replace(): void {
        console.log('Replace');
    }

    private save(): void {
        console.log('Save');
    }

    private fillDown(): void {
        console.log('Fill down');
    }

    private fillRight(): void {
        console.log('Fill right');
    }

    /**
     * Set action handlers
     */
    public setActionHandlers(handlers: Partial<{
        navigate: (direction: string, edit?: boolean) => void;
        selectAll: () => void;
        selectRow: () => void;
        selectColumn: () => void;
        editCell: () => void;
        clearCell: () => void;
        clearAndEdit: () => void;
        copy: () => void;
        cut: () => void;
        paste: () => void;
        undo: () => void;
        redo: () => void;
        find: () => void;
        replace: () => void;
        save: () => void;
        fillDown: () => void;
        fillRight: () => void;
    }>): void {
        Object.assign(this, handlers);
    }
}
