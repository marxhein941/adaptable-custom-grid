/**
 * Centralized logging utility for GridChangeTracker
 * Provides structured, tagged logging with different severity levels
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    OFF = 99
}

export enum LogTag {
    // Core component tags
    INIT = '[INIT]',
    UPDATE = '[UPDATE]',
    RENDER = '[RENDER]',
    DESTROY = '[DESTROY]',

    // Feature tags
    READONLY = '[READONLY]',
    EDITABLE = '[EDITABLE]',
    METADATA = '[METADATA]',
    DATASET = '[DATASET]',
    COLUMNS = '[COLUMNS]',

    // Operation tags
    SAVE = '[SAVE]',
    CHANGE = '[CHANGE]',
    VALIDATION = '[VALIDATION]',
    CONVERSION = '[CONVERSION]',

    // Utility tags
    AGGREGATION = '[AGGREGATION]',
    KEYBOARD = '[KEYBOARD]',
    PAGING = '[PAGING]',

    // Error tags
    ERROR = '[ERROR]',
    CRITICAL = '[CRITICAL]',
    WARNING = '[WARNING]'
}

interface LogContext {
    [key: string]: any;
}

class Logger {
    private static instance: Logger;
    private componentName = 'GridChangeTracker';
    private currentLogLevel: LogLevel = LogLevel.INFO;
    private enabledTags: Set<LogTag> = new Set<LogTag>(Object.values(LogTag));

    private constructor() {
        // Check for debug mode from URL parameters or localStorage
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const debugMode = urlParams.get('debug') || localStorage.getItem('gridTrackerDebug');

            if (debugMode === 'true' || debugMode === '1') {
                this.currentLogLevel = LogLevel.DEBUG;
            }

            // Check for specific tag filters
            const tagFilter = urlParams.get('debugTags') || localStorage.getItem('gridTrackerDebugTags');
            if (tagFilter) {
                // Parse tags and convert to LogTag enum values
                const tagNames = tagFilter.split(',').map(t => t.trim().toUpperCase());
                const validTags: LogTag[] = [];

                // Map string tag names to LogTag enum values
                for (const tagName of tagNames) {
                    const enumKey = `[${tagName}]`;
                    // Cast to string for comparison to avoid enum type issues
                    const tagValue = Object.values(LogTag).find(v => (v as string) === enumKey) as LogTag | undefined;
                    if (tagValue) {
                        validTags.push(tagValue);
                    }
                }

                this.enabledTags = new Set(validTags);
                console.log('[GridChangeTracker] Logger initialized with tags:', validTags);
            }

            // Log initialization settings
            console.log('[GridChangeTracker] Logger initialized:', {
                logLevel: this.currentLogLevel,
                debugEnabled: this.currentLogLevel === LogLevel.DEBUG,
                enabledTagsCount: this.enabledTags.size,
                enabledTags: Array.from(this.enabledTags)
            });
        }
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public setLogLevel(level: LogLevel): void {
        this.currentLogLevel = level;
    }

    public enableTag(tag: LogTag): void {
        this.enabledTags.add(tag);
    }

    public disableTag(tag: LogTag): void {
        this.enabledTags.delete(tag);
    }

    public setEnabledTags(tags: LogTag[]): void {
        this.enabledTags = new Set(tags);
    }

    private shouldLog(level: LogLevel, tag?: LogTag): boolean {
        if (level < this.currentLogLevel) {
            return false;
        }

        if (tag && !this.enabledTags.has(tag)) {
            return false;
        }

        return true;
    }

    private formatMessage(tag: LogTag | undefined, message: string): string {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        return `[${this.componentName}]${tag || ''} ${message}`;
    }

    private formatContext(context?: LogContext): string {
        if (!context) return '';

        // Format context object for better readability
        const formatted = Object.entries(context)
            .map(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    return `${key}: ${JSON.stringify(value, null, 2)}`;
                }
                return `${key}: ${value}`;
            })
            .join('\n  ');

        return formatted ? `\n  ${formatted}` : '';
    }

    public debug(tag: LogTag, message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.DEBUG, tag)) {
            const formattedMessage = this.formatMessage(tag, message);
            const contextStr = this.formatContext(context);
            console.log(formattedMessage + contextStr);
        }
    }

    public info(tag: LogTag, message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.INFO, tag)) {
            const formattedMessage = this.formatMessage(tag, message);
            const contextStr = this.formatContext(context);
            console.log(formattedMessage + contextStr);
        }
    }

    public warn(tag: LogTag, message: string, context?: LogContext): void {
        if (this.shouldLog(LogLevel.WARN, tag)) {
            const formattedMessage = this.formatMessage(tag, message);
            const contextStr = this.formatContext(context);
            console.warn(formattedMessage + contextStr);
        }
    }

    public error(tag: LogTag, message: string, error?: Error, context?: LogContext): void {
        if (this.shouldLog(LogLevel.ERROR, tag)) {
            const formattedMessage = this.formatMessage(tag, message);
            const contextStr = this.formatContext({
                ...context,
                ...(error && {
                    errorMessage: error.message,
                    errorStack: error.stack
                })
            });
            console.error(formattedMessage + contextStr);
        }
    }

    public critical(message: string, error?: Error, context?: LogContext): void {
        // Critical errors are always logged
        const formattedMessage = this.formatMessage(LogTag.CRITICAL, message);
        const contextStr = this.formatContext({
            ...context,
            ...(error && {
                errorMessage: error.message,
                errorStack: error.stack
            })
        });
        console.error(formattedMessage + contextStr);
    }

    public group(tag: LogTag, label: string): void {
        if (this.shouldLog(LogLevel.DEBUG, tag)) {
            console.group(this.formatMessage(tag, label));
        }
    }

    public groupEnd(): void {
        if (this.currentLogLevel <= LogLevel.DEBUG) {
            console.groupEnd();
        }
    }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Helper function for quick logging
export function log(tag: LogTag, message: string, context?: LogContext): void {
    logger.info(tag, message, context);
}

// Helper function for debugging read-only fields specifically
export function logReadOnlyDebug(message: string, context?: LogContext): void {
    logger.debug(LogTag.READONLY, message, context);
}

// Helper function for field editability checks
export function logEditability(fieldName: string, isEditable: boolean, reason?: string): void {
    logger.debug(LogTag.EDITABLE, `Field '${fieldName}' editability: ${isEditable}`, {
        field: fieldName,
        editable: isEditable,
        reason: reason || 'N/A'
    });
}