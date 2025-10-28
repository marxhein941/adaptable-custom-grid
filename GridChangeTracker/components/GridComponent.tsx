import * as React from 'react';
import { DetailsList, DetailsListLayoutMode, IColumn, SelectionMode, ColumnActionsMode } from '@fluentui/react/lib/DetailsList';
import { TextField } from '@fluentui/react/lib/TextField';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Icon } from '@fluentui/react/lib/Icon';
import { TooltipHost } from '@fluentui/react/lib/Tooltip';
import { ChangeTracker } from '../utils/changeTracker';
import { calculateAggregations, AggregationMode, getAggregationMode, AggregationResult } from '../utils/aggregations';
import { AggregationFooter } from './AggregationFooter';
import { ColumnResizeHandle } from './ColumnResizeHandle';
import { FillHandle } from './FillHandle';
import { BUILD_TIMESTAMP } from '../buildConstants';
import { debounce } from '../utils/debounce';
import { throttle } from '../utils/throttle';
import { getColumnDescriptions, defaultColumnDescriptions } from '../utils/metadataConfig';
import { convertValueByDataType, getColumnMetadata, isFieldEditableByType, isNumericType } from '../utils/typeConverter';
import { logger, log, LogTag, logReadOnlyDebug, logEditability } from '../utils/logger';
import { VerticalFillHelper } from '../utils/VerticalFillHelper';
import { KeyboardShortcutManager } from '../utils/keyboardShortcuts';

export interface IGridProps {
    dataset: ComponentFramework.PropertyTypes.DataSet;
    enableChangeTracking: boolean;
    changedCellColor: string;
    aggregationMode: number;
    showChangeIndicator: boolean;
    readOnlyFields: string;
    useDescriptionAsColumnName: boolean;
    // Row-level enable configuration
    enableRowsField?: string;      // Column to check for row-level control
    enableRowsValue?: string;      // Value that enables editing
    onCellChange: (recordId: string, columnName: string, value: any) => void;
    onSave: () => Promise<void>;
    // Add context to access WebAPI
    context?: ComponentFramework.Context<any>;
}

interface IGridState {
    currentData: any[];
    isLoading: boolean;
    isSaving: boolean;
    errorMessage: string | null;
    successMessage: string | null;
    aggregations: AggregationResult;
    sortColumn: string | null;
    isSortDescending: boolean;
    columns: IColumn[];
    readOnlyFieldsSet: Set<string>;
    columnWidths: Map<string, number>;  // Track custom column widths

    // Cell selection state for drag-fill functionality
    selectedCells: Set<string>;           // Format: "recordId_columnName"
    anchorCell: string | null;            // First selected cell
    selectionRange: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    } | null;

    // Drag-fill specific state
    isDraggingFill: boolean;
    fillPreviewRange: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    } | null;
    fillDirection: 'down' | 'up' | 'left' | 'right' | null;
    fillHandlePosition: { x: number; y: number } | null;
}

export class GridComponent extends React.Component<IGridProps, IGridState> {
    private changeTracker: ChangeTracker;
    private keyboardManager: KeyboardShortcutManager;
    private successMessageTimer?: NodeJS.Timeout;
    private debouncedNotifyChange: (recordId: string, columnName: string, value: any) => void;
    private throttledColumnResize: (columnKey: string, deltaX: number) => void;
    private columnDescriptions = new Map<string, string>();
    private entityMetadata = new Map<string, { isValidForUpdate: boolean; attributeType: string }>();
    private pageSizeSet = false; // Flag to track if we've set the max page size
    private headerRef = React.createRef<HTMLDivElement>();
    private bodyRef = React.createRef<HTMLDivElement>();

    constructor(props: IGridProps) {
        super(props);

        this.changeTracker = new ChangeTracker();

        // Initialize keyboard shortcut manager
        this.keyboardManager = new KeyboardShortcutManager();
        this.setupKeyboardHandlers();

        // Debounce cell change notifications to reduce rapid updates
        this.debouncedNotifyChange = debounce((recordId: string, columnName: string, value: any) => {
            this.props.onCellChange(recordId, columnName, value);
        }, 300);

        // Direct column resize without throttling for responsive resizing
        this.throttledColumnResize = this.handleColumnResize.bind(this);

        this.state = {
            currentData: [],
            isLoading: true,
            isSaving: false,
            errorMessage: null,
            successMessage: null,
            aggregations: {},
            sortColumn: null,
            isSortDescending: false,
            columns: [],
            readOnlyFieldsSet: this.parseReadOnlyFields(props.readOnlyFields),
            columnWidths: this.loadColumnWidths(),

            // Initialize selection state
            selectedCells: new Set(),
            anchorCell: null,
            selectionRange: null,
            isDraggingFill: false,
            fillPreviewRange: null,
            fillDirection: null,
            fillHandlePosition: null
        };
    }

    componentDidMount(): void {
        // Add keyboard event listener
        document.addEventListener('keydown', this.handleKeyDown);

        // Log all available columns for debugging
        logger.debug(LogTag.COLUMNS, 'Available columns in dataset', {
            columns: this.props.dataset.columns.map(col => ({
                name: col.name,
                displayName: col.displayName,
                alias: col.alias
            }))
        });

        // Set page size to maximum to load all records at once
        const needsRefresh = this.setMaxPageSize();

        // Only load data if we didn't trigger a refresh
        // (refresh will trigger updateView which will call loadData)
        if (!needsRefresh) {
            this.loadData();
        }

        void this.loadColumnDescriptions();
        void this.loadEntityMetadata();

        // Setup scroll synchronization between header and body
        this.setupScrollSync();
    }


    private setupScrollSync = (): void => {
        if (this.bodyRef.current) {
            // Remove existing listener first to prevent duplicates
            this.bodyRef.current.removeEventListener('scroll', this.handleBodyScroll);
            // Add listener
            this.bodyRef.current.addEventListener('scroll', this.handleBodyScroll);
        }
    }

    private handleBodyScroll = (): void => {
        if (this.bodyRef.current && this.headerRef.current) {
            // Sync horizontal scroll position from body to header
            this.headerRef.current.scrollLeft = this.bodyRef.current.scrollLeft;
        }
    }

    private setMaxPageSize(): boolean {
        const dataset = this.props.dataset;

        logger.debug(LogTag.PAGING, 'setMaxPageSize() called', { pageSizeSet: this.pageSizeSet });

        // Only set page size once to avoid infinite loops
        if (this.pageSizeSet) {
            logger.debug(LogTag.PAGING, 'Page size already set, skipping');
            return false;
        }

        // Check if dataset and paging are available
        if (dataset && dataset.paging) {
            const currentPageSize = dataset.paging.pageSize;
            const totalCount = dataset.paging.totalResultCount;

            logger.info(LogTag.PAGING, 'Paging info', {
                currentPageSize,
                totalRecords: totalCount,
                hasNextPage: dataset.paging.hasNextPage
            });

            // Set page size to 5000 (maximum allowed by Dataverse)
            // This will load all records up to 5000 in a single page
            if (currentPageSize < 5000) {
                logger.info(LogTag.PAGING, `Setting page size from ${currentPageSize} to 5000`);
                dataset.paging.setPageSize(5000);
                logger.debug(LogTag.PAGING, 'Page size after setting', { pageSize: dataset.paging.pageSize });

                // Mark that we've set the page size
                this.pageSizeSet = true;

                // Refresh the dataset to load all records with the new page size
                logger.info(LogTag.PAGING, 'Calling dataset.refresh() to reload with new page size');
                dataset.refresh();

                // Return true to indicate we triggered a refresh
                return true;
            } else {
                logger.debug(LogTag.PAGING, `Page size already at maximum: ${currentPageSize}`);
                this.pageSizeSet = true;
            }
        } else {
            logger.warn(LogTag.PAGING, 'Cannot set page size - paging not available', {
                hasDataset: !!dataset,
                hasPaging: !!(dataset && dataset.paging)
            });
        }

        return false;
    }

    componentWillUnmount(): void {
        // Clean up timers to prevent memory leaks
        if (this.successMessageTimer) {
            clearTimeout(this.successMessageTimer);
        }
        // Clean up keyboard event listener
        document.removeEventListener('keydown', this.handleKeyDown);
        // Clean up scroll event listeners
        if (this.bodyRef.current) {
            this.bodyRef.current.removeEventListener('scroll', this.handleBodyScroll);
        }
    }

    componentDidUpdate(prevProps: IGridProps): void {
        // Reload data if dataset changes
        if (prevProps.dataset !== this.props.dataset) {
            // Ensure max page size is set for new dataset
            const needsRefresh = this.setMaxPageSize();

            // Only load data if we didn't trigger a refresh
            // (refresh will trigger updateView which will call componentDidUpdate again with new data)
            if (!needsRefresh) {
                this.loadData();
            }
        }

        // Recalculate aggregations if mode changes
        if (prevProps.aggregationMode !== this.props.aggregationMode) {
            this.calculateAggregations();
        }

        // Update read-only fields if configuration changes
        if (prevProps.readOnlyFields !== this.props.readOnlyFields) {
            this.setState({
                readOnlyFieldsSet: this.parseReadOnlyFields(this.props.readOnlyFields)
            });
        }

        // Re-setup scroll sync if needed
        this.setupScrollSync();
    }

    private parseReadOnlyFields(readOnlyFieldsString: string): Set<string> {
        if (!readOnlyFieldsString || readOnlyFieldsString.trim() === '') {
            logReadOnlyDebug('No read-only fields configured');
            return new Set<string>();
        }

        logReadOnlyDebug('Raw read-only fields input', {
            raw: readOnlyFieldsString,
            length: readOnlyFieldsString.length
        });

        // Split by comma or newline to support both formats
        // This allows for longer lists using the Multiple text field type
        // IMPORTANT: Convert to lowercase for case-insensitive matching
        const fields = readOnlyFieldsString
            .split(/[,\n\r]+/) // Split by comma, newline, or carriage return
            .map(field => field.trim().toLowerCase()) // Convert to lowercase for case-insensitive matching
            .filter(field => field.length > 0);

        logger.info(LogTag.READONLY, `Parsed ${fields.length} read-only fields (case-insensitive)`, {
            originalFields: readOnlyFieldsString.split(/[,\n\r]+/).map(f => f.trim()).filter(f => f.length > 0),
            normalizedFields: fields,
            // Log each field with character codes to debug hidden characters
            fieldsDebug: fields.map(f => ({ field: f, length: f.length, charCodes: f.split('').map(c => c.charCodeAt(0)) }))
        });

        return new Set<string>(fields);
    }

    /**
     * Determines if a row is editable based on enableRowsField configuration
     * @param item The row data object containing all column values
     * @returns true if row should be editable, false if entire row should be read-only
     */
    private isRowEditable(item: any): boolean {
        // If no row-level configuration, all rows are editable by default
        if (!this.props.enableRowsField || !this.props.enableRowsValue) {
            return true;
        }

        const fieldNameInput = this.props.enableRowsField.trim();
        const expectedValue = this.props.enableRowsValue.trim();

        // CASE-INSENSITIVE: Find the field in the item using case-insensitive matching
        const itemKeys = Object.keys(item);
        const matchedKey = itemKeys.find(key => key.toLowerCase() === fieldNameInput.toLowerCase());

        // Check if the field exists in the row data
        if (!matchedKey) {
            logger.warn(LogTag.EDITABLE,
                `Enable rows field "${fieldNameInput}" not found in row data. Row will be read-only.`,
                {
                    recordId: item.id,
                    availableFields: itemKeys.filter(k => !k.endsWith('_raw'))
                }
            );
            return false;
        }

        const actualValue = item[matchedKey];

        // Case-insensitive comparison for string values
        const matches = String(actualValue).toLowerCase().trim() ===
                        expectedValue.toLowerCase();

        logger.debug(LogTag.EDITABLE,
            `Row editability check for record ${item.id}`,
            {
                fieldNameInput,
                matchedFieldName: matchedKey,
                expectedValue,
                actualValue,
                matches,
                rowIsEditable: matches
            }
        );

        return matches;
    }

    private isFieldEditable(columnName: string, item?: any): boolean {
        // FIRST: Check if the entire row is editable (row-level control)
        if (item && !this.isRowEditable(item)) {
            // CASE-INSENSITIVE: Find the actual field name in the item
            let actualValue = 'N/A';
            if (this.props.enableRowsField) {
                const itemKeys = Object.keys(item);
                const fieldNameLower = this.props.enableRowsField.trim().toLowerCase();
                const matchedKey = itemKeys.find(key => key.toLowerCase() === fieldNameLower);
                actualValue = matchedKey ? item[matchedKey] : 'N/A';
            }
            logEditability(columnName, false,
                `Row disabled: ${this.props.enableRowsField} = '${actualValue}' (expected '${this.props.enableRowsValue}')`
            );
            return false;
        }

        // CASE-INSENSITIVE: Compare using lowercase
        const columnNameLower = columnName.toLowerCase();
        const isInReadOnlySet = this.state.readOnlyFieldsSet.has(columnNameLower);
        const readOnlyArray = Array.from(this.state.readOnlyFieldsSet);

        // Log at INFO level first to ensure we see it
        logger.info(LogTag.EDITABLE, `Checking editability for field: "${columnName}" (normalized: "${columnNameLower}")`, {
            originalColumnName: columnName,
            normalizedColumnName: columnNameLower,
            readOnlyFieldsSet: readOnlyArray,
            fieldIsInSet: isInReadOnlySet,
            // Add exact match debugging
            exactMatches: readOnlyArray.map(f => ({
                field: f,
                matches: f === columnNameLower,
                fieldLength: f.length,
                columnLength: columnNameLower.length
            }))
        });

        // Comprehensive debugging for read-only field checking
        logReadOnlyDebug(`Checking editability for field: "${columnName}"`, {
            originalColumnName: columnName,
            normalizedColumnName: columnNameLower,
            readOnlyFieldsArray: readOnlyArray,
            fieldIsInSet: isInReadOnlySet,
            setSize: this.state.readOnlyFieldsSet.size
        });

        // Check if field is in the read-only configuration - MOST IMPORTANT CHECK
        if (isInReadOnlySet) {
            logEditability(columnName, false, 'Field is in read-only configuration list');
            logger.error(LogTag.READONLY, `!!!FIELD SHOULD BE READ-ONLY!!!: "${columnName}"`);
            return false;
        }

        // Check column metadata for any indicators
        const column = this.props.dataset.columns.find(col => col.name === columnName);
        if (!column) {
            logEditability(columnName, false, 'Column not found in dataset');
            return false;
        }

        // Check if column is the primary field (usually read-only)
        if (column.isPrimary) {
            logEditability(columnName, false, 'Field is primary key');
            return false;
        }

        // FIRST: Check the real metadata from Dataverse API (if loaded)
        const realMetadata = this.entityMetadata.get(columnName);
        if (realMetadata) {
            // Use the authoritative IsValidForUpdate from the server
            if (realMetadata.isValidForUpdate === false) {
                logEditability(columnName, false, 'Server metadata: IsValidForUpdate=false');
                return false;
            }

            // Check if it's a Virtual attribute type (from server metadata)
            if (realMetadata.attributeType === 'Virtual') {
                logEditability(columnName, false, 'Server metadata: Virtual attribute type');
                return false;
            }
        }

        // FALLBACK: Get column metadata from PCF dataset (less reliable)
        const columnMetadata = getColumnMetadata(this.props.dataset, columnName);
        if (!columnMetadata) {
            logEditability(columnName, false, 'No column metadata available');
            return false;
        }

        // If we don't have real metadata yet, use the PCF dataset metadata as fallback
        if (!realMetadata) {
            // Check if field is marked as not valid for update (from PCF dataset - may be incomplete)
            if (columnMetadata.isValidForUpdate === false) {
                logEditability(columnName, false, 'PCF dataset: IsValidForUpdate=false');
                return false;
            }

            // Check if it's a virtual field (from PCF dataset)
            if (columnMetadata.isVirtualField) {
                logEditability(columnName, false, 'PCF dataset: Virtual field');
                return false;
            }
        }

        // Check if it's a name field (logical representation of lookup fields)
        // These end with "name" or "yominame" and are display-only
        if (columnMetadata.isNameField) {
            logEditability(columnName, false, 'Name field (logical/display-only)');
            return false;
        }

        // Check if this field type can be edited in a grid context
        const dataType = columnMetadata.dataType;
        if (!isFieldEditableByType(dataType)) {
            logEditability(columnName, false, `Field type ${dataType} not editable in grid`);
            return false;
        }

        // Default to editable
        logEditability(columnName, true, 'Field passed all checks');
        return true;
    }

    private async loadEntityMetadata(): Promise<void> {
        try {
            const entityType = this.props.dataset.getTargetEntityType();
            if (!entityType) {
                logger.warn(LogTag.METADATA, 'Unable to load entity metadata: No entity type available');
                return;
            }

            logger.info(LogTag.METADATA, `Loading entity metadata for: ${entityType}`);

            // Try to get the client URL from Xrm context
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const globalContext = (window as any).Xrm?.Utility?.getGlobalContext?.();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const clientUrl = globalContext?.getClientUrl?.() ||
                             // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                             (window as any).parent?.Xrm?.Utility?.getGlobalContext?.()?.getClientUrl?.();

            if (!clientUrl) {
                console.warn('[GridComponent] Could not determine client URL for metadata fetch');
                return;
            }

            // Fetch entity metadata with IsValidForUpdate property
            const apiUrl = `${clientUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${entityType}')?$select=LogicalName&$expand=Attributes($select=LogicalName,IsValidForUpdate,AttributeType)`;

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'OData-MaxVersion': '4.0',
                    'OData-Version': '4.0'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                console.warn('[GridComponent] Failed to fetch entity metadata:', response.status, response.statusText);
                return;
            }

            const data = await response.json();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (data?.Attributes && Array.isArray(data.Attributes)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
                data.Attributes.forEach((attr: any) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const logicalName = attr.LogicalName as string;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const isValidForUpdate = attr.IsValidForUpdate as boolean;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const attributeType = attr.AttributeType as string;

                    if (logicalName) {
                        this.entityMetadata.set(logicalName, {
                            isValidForUpdate: isValidForUpdate ?? true,
                            attributeType: attributeType || 'Unknown'
                        });
                    }
                });

                console.log(`[GridComponent] Loaded metadata for ${this.entityMetadata.size} attributes`);

                // Force a re-render now that we have metadata
                this.forceUpdate();
            }
        } catch (error) {
            console.error('[GridComponent] Error loading entity metadata:', error);
        }
    }

    private async loadColumnDescriptions(): Promise<void> {
        try {
            // Get the entity logical name from the dataset
            const entityType = this.props.dataset.getTargetEntityType();

            if (!entityType) {
                console.warn('[GridComponent] Unable to load column descriptions: No entity type available');
                // Fall back to configured descriptions
                this.loadConfiguredDescriptions();
                return;
            }

            console.log(`[GridComponent] Loading column descriptions for entity: ${entityType}`);

            // Try to load metadata dynamically first
            const metadataLoaded = await this.loadDynamicMetadata(entityType);

            if (!metadataLoaded) {
                // If dynamic loading fails, fall back to configured descriptions
                this.loadConfiguredDescriptions();
            }

            // Add default system field descriptions for any missing columns
            Object.entries(defaultColumnDescriptions).forEach(([columnName, description]) => {
                if (!this.columnDescriptions.has(columnName)) {
                    this.columnDescriptions.set(columnName, description);
                }
            });

            console.log(`[GridComponent] Total column descriptions loaded: ${this.columnDescriptions.size}`);
        } catch (error) {
            console.error('[GridComponent] Error in loadColumnDescriptions:', error);
            // Try to load configured descriptions as fallback
            this.loadConfiguredDescriptions();
        }
    }

    private async loadDynamicMetadata(entityType: string): Promise<boolean> {
        try {
            // Approach 1: Try direct Web API call (most reliable for metadata)
            try {
                // Get the base URL from the page context
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                const globalContext = (window as any).Xrm?.Utility?.getGlobalContext?.();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                const clientUrl = globalContext?.getClientUrl?.() ||
                                 // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                                 (window as any).parent?.Xrm?.Utility?.getGlobalContext?.()?.getClientUrl?.();

                if (clientUrl) {
                    console.log('[GridComponent] Attempting direct Web API call for metadata');
                    const apiUrl = `${clientUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${entityType}')?$select=LogicalName,DisplayName&$expand=Attributes($select=LogicalName,DisplayName,Description)`;

                    // Use fetch to make the request
                    const response = await fetch(apiUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'OData-MaxVersion': '4.0',
                            'OData-Version': '4.0',
                            'Prefer': 'odata.include-annotations="*"'
                        },
                        credentials: 'same-origin'
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data?.Attributes) {
                            this.processMetadataAttributes(data.Attributes);
                            console.log(`[GridComponent] Successfully loaded ${this.columnDescriptions.size} descriptions via direct Web API`);
                            this.forceUpdate();
                            return true;
                        }
                    } else {
                        console.log('[GridComponent] Direct Web API call failed:', response.status, response.statusText);
                    }
                } else {
                    console.log('[GridComponent] Could not determine client URL for Web API call');
                }
            } catch (fetchError) {
                console.log('[GridComponent] Direct Web API approach failed:', fetchError);
            }

            // Approach 2: Use Xrm.Utility.getEntityMetadata (fallback)
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const xrm = (window as any).parent?.Xrm || (window as any).Xrm;

                if (xrm?.Utility?.getEntityMetadata) {
                    console.log('[GridComponent] Using Xrm.Utility.getEntityMetadata approach');

                    // Get entity metadata with attributes - this method supports attributes expansion
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    const entityMetadata = await xrm.Utility.getEntityMetadata(entityType, ['Attributes']);

                    // The Attributes should be directly available
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    const attributes = entityMetadata?.Attributes;

                    if (attributes && Array.isArray(attributes)) {
                        this.processMetadataAttributes(attributes);
                        console.log(`[GridComponent] Loaded ${this.columnDescriptions.size} descriptions via Xrm.Utility.getEntityMetadata`);
                        this.forceUpdate();
                        return true;
                    }
                }
            } catch (xrmError) {
                console.log('[GridComponent] Xrm.Utility.getEntityMetadata not available or failed:', xrmError);
            }

            return false;
        } catch (error) {
            console.error('[GridComponent] Failed to load dynamic metadata:', error);
            return false;
        }
    }

    private processMetadataAttributes(attributes: any[]): void {
        if (!attributes || !Array.isArray(attributes)) {
            console.warn('[GridComponent] No attributes found in metadata');
            return;
        }

        console.log(`[GridComponent] Processing ${attributes.length} attributes from metadata`);
        let descriptionsFound = 0;

        attributes.forEach((attr: any) => {
            // Log the structure for debugging
            console.log('[GridComponent] Attribute structure:', {
                LogicalName: attr.LogicalName,
                Description: attr.Description,
                DisplayName: attr.DisplayName
            });

            // Handle different metadata structures
            const logicalName = attr.LogicalName || attr.logicalName;
            const description = attr.Description?.UserLocalizedLabel?.Label ||
                              attr.Description?.LocalizedLabels?.[0]?.Label ||
                              attr.description?.userLocalizedLabel?.label ||
                              attr.Description; // Sometimes it's just a string
            const displayName = attr.DisplayName?.UserLocalizedLabel?.Label ||
                              attr.DisplayName?.LocalizedLabels?.[0]?.Label ||
                              attr.displayName?.userLocalizedLabel?.label ||
                              attr.DisplayName; // Sometimes it's just a string

            // Use description if available, otherwise use display name
            const tooltipText = description || displayName;

            if (logicalName) {
                if (tooltipText) {
                    this.columnDescriptions.set(logicalName, tooltipText);
                    if (description) {
                        descriptionsFound++;
                    }
                    console.log(`[GridComponent] Loaded for ${logicalName}: ${description ? 'Description' : 'DisplayName'} = "${tooltipText}"`);
                } else {
                    console.log(`[GridComponent] No description or display name for ${logicalName}`);
                }
            }
        });

        console.log(`[GridComponent] Loaded ${this.columnDescriptions.size} tooltips (${descriptionsFound} with descriptions)`);
    }

    private loadConfiguredDescriptions(): void {
        try {
            // Load metadata from imported configuration (fallback to static config if available)
            const importedDescriptions = getColumnDescriptions();
            if (importedDescriptions.size > 0) {
                importedDescriptions.forEach((description, columnName) => {
                    if (!this.columnDescriptions.has(columnName)) {
                        this.columnDescriptions.set(columnName, description);
                        console.log(`[GridComponent] Loaded static metadata description for ${columnName}: ${description}`);
                    }
                });
                console.log(`[GridComponent] Loaded ${importedDescriptions.size} column descriptions from static metadata config`);
            }

            // Use column display names as final fallback
            this.props.dataset.columns.forEach(column => {
                if (!this.columnDescriptions.has(column.name) && column.displayName && column.displayName !== column.name) {
                    this.columnDescriptions.set(column.name, `Field: ${column.displayName}`);
                    console.log(`[GridComponent] Using display name for ${column.name}: ${column.displayName}`);
                }
            });

        } catch (error) {
            console.error('[GridComponent] Failed to load configured descriptions:', error);
        }
    }

    private loadData = (): void => {
        try {
            console.log('[GridComponent] loadData() called');
            const records = this.loadRecordsFromDataset(this.props.dataset);
            console.log(`[GridComponent] Loaded ${records.length} records from dataset`);

            this.changeTracker.initializeData(records);

            // Initialize columns with default widths
            const initialColumns = this.buildColumns();

            this.setState({
                currentData: records,
                isLoading: false,
                errorMessage: null,
                sortColumn: null,
                isSortDescending: false,
                columns: initialColumns
            }, () => {
                this.calculateAggregations();
            });
        } catch (error) {
            console.error('Error loading data:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.setState({
                isLoading: false,
                errorMessage: `Failed to load data: ${errorMessage}`
            });
        }
    }

    private loadRecordsFromDataset(dataset: ComponentFramework.PropertyTypes.DataSet): any[] {
        if (!dataset || !dataset.sortedRecordIds) {
            console.warn('[GridComponent] loadRecordsFromDataset - No dataset or sortedRecordIds');
            return [];
        }

        console.log(`[GridComponent] loadRecordsFromDataset - sortedRecordIds.length: ${dataset.sortedRecordIds.length}`);

        return dataset.sortedRecordIds.map(id => {
            const record: any = { id: id };

            dataset.columns.forEach(col => {
                // Get both raw and formatted values
                const rawValue = dataset.records[id].getValue(col.name);
                const formattedValue = dataset.records[id].getFormattedValue(col.name);

                // Use formatted value for display, but store raw value for comparisons
                record[col.name] = formattedValue || rawValue || '';
                record[`${col.name}_raw`] = rawValue;
            });

            return record;
        });
    }

    private calculateAggregations = (): void => {
        const mode = getAggregationMode(this.props.aggregationMode);

        if (mode === AggregationMode.None) {
            this.setState({ aggregations: {} });
            return;
        }

        const aggregations = calculateAggregations(
            this.state.currentData,
            this.props.dataset.columns,
            mode
        );

        this.setState({ aggregations });
    }

    private handleSort = (column: IColumn): void => {
        const { currentData, sortColumn, isSortDescending } = this.state;
        const columnName = column.fieldName || column.key;

        // Determine new sort direction
        const newIsSortDescending = sortColumn === columnName ? !isSortDescending : false;

        // Sort the data
        const sortedData = [...currentData].sort((a, b) => {
            const aValue = a[columnName] || '';
            const bValue = b[columnName] || '';

            // Handle numeric sorting
            const aNum = parseFloat(aValue);
            const bNum = parseFloat(bValue);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return newIsSortDescending ? bNum - aNum : aNum - bNum;
            }

            // Handle string sorting
            const aStr = String(aValue).toLowerCase();
            const bStr = String(bValue).toLowerCase();

            if (aStr < bStr) return newIsSortDescending ? 1 : -1;
            if (aStr > bStr) return newIsSortDescending ? -1 : 1;
            return 0;
        });

        this.setState({
            currentData: sortedData,
            sortColumn: columnName,
            isSortDescending: newIsSortDescending
        }, () => {
            this.calculateAggregations();
        });
    }


    private calculateOptimalColumnWidth = (columnName: string, displayName: string, data: any[]): number => {
        // Base width calculation factors
        const CHAR_WIDTH = 8; // Average character width in pixels
        const PADDING = 24; // Cell padding + borders + margin
        const MIN_WIDTH = 100; // Minimum column width
        const MAX_WIDTH = 300; // Maximum column width
        const HEADER_EXTRA = 40; // Extra space for sort icon, filter, dropdown

        // Calculate width based on column header name
        const headerWidth = (displayName.length * CHAR_WIDTH) + HEADER_EXTRA;

        // Calculate width based on content in the first 100 rows (for performance)
        const sampleData = data.slice(0, 100);
        const contentWidths = sampleData.map(row => {
            const value = String(row[columnName] || '');
            return (value.length * CHAR_WIDTH) + PADDING;
        });

        const maxContentWidth = contentWidths.length > 0 ? Math.max(...contentWidths) : MIN_WIDTH;

        // Use the larger of header width or content width
        const optimalWidth = Math.max(headerWidth, maxContentWidth);

        // Clamp between min and max
        return Math.min(Math.max(optimalWidth, MIN_WIDTH), MAX_WIDTH);
    }

    private buildColumns = (): IColumn[] => {
        if (!this.props.dataset || !this.props.dataset.columns) {
            return [];
        }

        const { sortColumn, isSortDescending, columns: stateColumns, columnWidths, currentData } = this.state;

        // Column width constants
        const DEFAULT_COLUMN_WIDTH = 180;  // Increased by 20% from 150
        const MIN_COLUMN_WIDTH = 60;       // Increased by 20% from 50
        const MAX_COLUMN_WIDTH = 480;      // Increased by 20% from 400

        // Filter out the primary column (isPrimary property)
        const visibleColumns = this.props.dataset.columns.filter(col => {
            const isPrimary = (col as any).isPrimary === true;
            if (isPrimary) {
                logger.info(LogTag.COLUMNS, `Excluding primary column: ${col.name}`);
            }
            return !isPrimary;
        });

        logger.debug(LogTag.COLUMNS, `Building columns`, {
            totalColumns: this.props.dataset.columns.length,
            visibleColumns: visibleColumns.length,
            excludedCount: this.props.dataset.columns.length - visibleColumns.length
        });

        return visibleColumns.map(col => {
            const isSorted = sortColumn === col.name;

            // Debug: Log column metadata to verify description availability
            console.log(`[Column ${col.name}]`, {
                displayName: col.displayName,
                description: (col as any).description,
                metadata: (col as any).metadata,
                tooltip: (col as any).tooltip
            });

            // Get column width from state (saved widths or existing resized width)
            const savedWidth = columnWidths.get(col.name);
            const existingColumn = stateColumns.find(c => c.key === col.name);
            const columnWidth = existingColumn?.currentWidth || savedWidth || DEFAULT_COLUMN_WIDTH;

            // Determine column display name based on useDescriptionAsColumnName setting
            let columnDisplayName = col.displayName;
            if (this.props.useDescriptionAsColumnName) {
                const description = this.columnDescriptions.get(col.name);
                // Ensure description is a string before using trim()
                if (description && typeof description === 'string' && description.trim() !== '') {
                    columnDisplayName = description;
                }
            }

            return {
                key: col.name,
                name: columnDisplayName,
                fieldName: col.name,
                minWidth: MIN_COLUMN_WIDTH,
                maxWidth: MAX_COLUMN_WIDTH,
                currentWidth: columnWidth,
                isResizable: true,  // Enable resizing
                isSorted: isSorted,
                isSortedDescending: isSorted ? isSortDescending : undefined,
                columnActionsMode: ColumnActionsMode.disabled,
                onRender: (item: any) => this.renderCell(item, col.name),
                flexGrow: 0
            };
        });
    }

    private handleColumnResize = (columnKey: string, deltaX: number): void => {
        this.setState(prevState => {
            const column = prevState.columns.find(col => col.key === columnKey);
            if (!column) return null;

            const currentWidth = column.currentWidth || 150;
            const newWidth = Math.max(column.minWidth || 50, Math.min(currentWidth + deltaX, column.maxWidth || 400));

            if (newWidth === currentWidth) return null;

            const updatedColumns = prevState.columns.map(col =>
                col.key === columnKey
                    ? { ...col, currentWidth: newWidth }
                    : col
            );

            // Update saved widths
            const newColumnWidths = new Map(prevState.columnWidths);
            newColumnWidths.set(columnKey, newWidth);

            // Save to localStorage
            this.saveColumnWidths(newColumnWidths);

            return {
                ...prevState,
                columns: updatedColumns,
                columnWidths: newColumnWidths
            };
        });
    }

    private saveColumnWidths = (widths: Map<string, number>): void => {
        try {
            const widthsObject: { [key: string]: number } = {};
            widths.forEach((value, key) => {
                widthsObject[key] = value;
            });

            const storageKey = `grid-column-widths-${this.props.dataset?.getTitle() || 'default'}`;
            localStorage.setItem(storageKey, JSON.stringify(widthsObject));
        } catch (error) {
            console.error('Failed to save column widths:', error);
        }
    }

    private loadColumnWidths = (): Map<string, number> => {
        try {
            const storageKey = `grid-column-widths-${this.props.dataset?.getTitle() || 'default'}`;
            const saved = localStorage.getItem(storageKey);

            if (saved) {
                const widthsObject = JSON.parse(saved);
                return new Map(Object.entries(widthsObject));
            }
        } catch (error) {
            console.error('Failed to load column widths:', error);
        }

        return new Map<string, number>();
    }


    private renderCustomHeader = (): JSX.Element => {
        return (
            <div className="custom-sticky-header" ref={this.headerRef}>
                {/* Column Headers Row */}
                <div className="custom-header-row">
                    {this.state.columns.map(col => {
                        const columnName = col.key;
                        const column = this.props.dataset.columns.find(c => c.name === columnName);
                        const originalDisplayName = column?.displayName || columnName;

                        // Determine what to show in the header and tooltip
                        // Rule: Show the inverse of what's in the header
                        let headerText = originalDisplayName;
                        let tooltipText = '';

                        const description = this.columnDescriptions.get(columnName);
                        const hasDescription = description && typeof description === 'string' && description.trim() !== '';

                        if (this.props.useDescriptionAsColumnName) {
                            // Header shows Description, Tooltip shows Column Name
                            if (hasDescription) {
                                headerText = description;
                                tooltipText = originalDisplayName; // Show column name in tooltip
                            }
                        } else {
                            // Header shows Column Name, Tooltip shows Description
                            if (hasDescription) {
                                headerText = originalDisplayName;
                                tooltipText = description; // Show description in tooltip
                            }
                        }

                        const hasTooltip = typeof tooltipText === 'string' && tooltipText.trim().length > 0;

                        // Check if column is numeric for alignment
                        const columnMetadata = getColumnMetadata(this.props.dataset, columnName);
                        const isNumeric = isNumericType(columnMetadata?.dataType);

                        const headerContent = (
                            <div style={{
                                display: 'flex',
                                justifyContent: isNumeric ? 'flex-end' : 'flex-start',
                                alignItems: 'center',
                                width: '100%',
                                paddingRight: isNumeric ? '8px' : '0',
                                paddingLeft: isNumeric ? '0' : '8px'
                            }}>
                                <span className="column-name">
                                    {headerText}
                                </span>
                                {hasTooltip && (
                                    <Icon
                                        iconName="Info"
                                        className="column-info-icon"
                                        styles={{
                                            root: {
                                                marginLeft: 4,
                                                fontSize: 12,
                                                color: '#605e5c',
                                                verticalAlign: 'middle',
                                                cursor: 'help'
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        );

                        return (
                            <div
                                key={`header-${columnName}`}
                                className="custom-header-cell"
                                data-column-key={columnName}
                                style={{
                                    width: col.currentWidth || col.minWidth,
                                    minWidth: col.minWidth,
                                    maxWidth: col.maxWidth,
                                    position: 'relative'
                                }}
                                onClick={() => this.handleSort(col)}
                            >
                                {hasTooltip ? (
                                    <TooltipHost
                                        content={tooltipText}
                                        id={`col-tooltip-${columnName}`}
                                        calloutProps={{
                                            gapSpace: 0,
                                            beakWidth: 10
                                        }}
                                    >
                                        {headerContent}
                                    </TooltipHost>
                                ) : (
                                    headerContent
                                )}
                                {/* Sort indicator */}
                                {this.state.sortColumn === columnName && (
                                    <Icon
                                        iconName={this.state.isSortDescending ? 'SortDown' : 'SortUp'}
                                        styles={{ root: { marginLeft: 4, fontSize: 12 } }}
                                    />
                                )}
                                {/* Resize handle */}
                                <ColumnResizeHandle
                                    columnKey={columnName}
                                    onResize={this.throttledColumnResize}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    private renderCustomRows = (): JSX.Element => {
        const { currentData, columns } = this.state;

        return (
            <div className="custom-data-rows">
                {currentData.map((item, rowIndex) => {
                    const isRowDisabled = !this.isRowEditable(item);
                    const rowClassName = `custom-data-row${isRowDisabled ? ' row-disabled' : ''}`;

                    // CASE-INSENSITIVE: Get the actual value for the tooltip
                    let actualFieldValue = 'N/A';
                    if (isRowDisabled && this.props.enableRowsField) {
                        const itemKeys = Object.keys(item);
                        const fieldNameLower = this.props.enableRowsField.trim().toLowerCase();
                        const matchedKey = itemKeys.find(key => key.toLowerCase() === fieldNameLower);
                        actualFieldValue = matchedKey ? item[matchedKey] : 'N/A';
                    }

                    const rowTitle = isRowDisabled && this.props.enableRowsField && this.props.enableRowsValue
                        ? `This row is read-only because ${this.props.enableRowsField} = '${actualFieldValue}' (only '${this.props.enableRowsValue}' rows are editable)`
                        : undefined;

                    return (
                        <div
                            key={item.id || rowIndex}
                            className={rowClassName}
                            title={rowTitle}
                        >
                            {columns.map(col => {
                                const columnName = col.key;
                                return (
                                    <div
                                        key={`${item.id}-${columnName}`}
                                        className="custom-data-cell"
                                        style={{
                                            width: col.currentWidth || col.minWidth,
                                            minWidth: col.minWidth,
                                            maxWidth: col.maxWidth
                                        }}
                                    >
                                        {this.renderCell(item, columnName)}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        );
    }

    private renderCell = (item: any, columnName: string): JSX.Element => {
        // Debug: Log the actual column name being rendered
        // Enhanced logging for read-only debugging
        logger.debug(LogTag.RENDER, `Rendering cell for column: "${columnName}"`, {
            recordId: item.id,
            columnName
        });

        const cellKey = `${item.id}_${columnName}`;
        const isSelected = this.state.selectedCells.has(cellKey);
        const isAnchor = this.state.anchorCell === cellKey;
        const isInFillPreview = this.isCellInFillPreview(cellKey);

        const isChanged = this.changeTracker.isCellChanged(item.id, columnName);
        const value = item[columnName] || '';
        // UPDATED: Pass item to check row-level editability
        const isEditable = this.isFieldEditable(columnName, item);

        // CRITICAL: Log rendering decision for read-only fields (CASE-INSENSITIVE)
        if (this.state.readOnlyFieldsSet.has(columnName.toLowerCase())) {
            logger.error(LogTag.RENDER, `RENDERING READ-ONLY FIELD: "${columnName}"`, undefined, {
                columnName,
                normalizedColumnName: columnName.toLowerCase(),
                isEditable,
                isInReadOnlySet: true,
                willRenderAsSpan: !isEditable,
                value
            });
        }

        // Critical logging for read-only field debugging - using both tags for visibility (CASE-INSENSITIVE)
        logEditability(columnName, isEditable,
            !isEditable && this.state.readOnlyFieldsSet.has(columnName.toLowerCase())
                ? 'Field is in read-only configuration list'
                : 'Other reason');

        // Also log with READONLY tag for completeness (CASE-INSENSITIVE)
        logReadOnlyDebug(`Column "${columnName}" editability result`, {
            columnName,
            normalizedColumnName: columnName.toLowerCase(),
            isEditable,
            isInReadOnlySet: this.state.readOnlyFieldsSet.has(columnName.toLowerCase()),
            readOnlySetSize: this.state.readOnlyFieldsSet.size
        });

        const column = this.props.dataset.columns.find(col => col.name === columnName);
        const displayName = column?.displayName || columnName;

        // Get metadata to determine WHY field is not editable (for better UX)
        const columnMetadata = getColumnMetadata(this.props.dataset, columnName);
        const isNumeric = isNumericType(columnMetadata?.dataType);
        let readOnlyReason = '';
        if (!isEditable) {
            // Check row-level disable first
            if (!this.isRowEditable(item)) {
                // CASE-INSENSITIVE: Find the actual field name in the item
                let actualValue = 'N/A';
                if (this.props.enableRowsField) {
                    const itemKeys = Object.keys(item);
                    const fieldNameLower = this.props.enableRowsField.trim().toLowerCase();
                    const matchedKey = itemKeys.find(key => key.toLowerCase() === fieldNameLower);
                    actualValue = matchedKey ? item[matchedKey] : 'N/A';
                }
                readOnlyReason = `Row is read-only: ${this.props.enableRowsField} = '${actualValue}' (only '${this.props.enableRowsValue}' rows are editable)`;
            } else if (column?.isPrimary) {
                readOnlyReason = 'Primary key field';
            } else if (columnMetadata?.isVirtualField) {
                readOnlyReason = 'Virtual/computed field';
            } else if (columnMetadata?.isNameField) {
                readOnlyReason = 'Display-only name field';
            } else if (columnMetadata?.isValidForUpdate === false) {
                readOnlyReason = 'System field or read-only by design';
            } else if (this.state.readOnlyFieldsSet.has(columnName)) {
                readOnlyReason = 'Configured as read-only';
            } else {
                readOnlyReason = 'Field type not supported for inline editing';
            }
        }

        // CRITICAL: Double-check editability right before rendering (CASE-INSENSITIVE)
        // This ensures we catch any race conditions or state inconsistencies
        const finalIsEditable = isEditable && !this.state.readOnlyFieldsSet.has(columnName.toLowerCase());

        const cellStyle: React.CSSProperties = {
            backgroundColor: isChanged && this.props.enableChangeTracking
                ? this.props.changedCellColor
                : isSelected
                    ? 'rgba(0, 120, 212, 0.05)'
                    : finalIsEditable ? 'transparent' : '#f3f2f1',
            padding: '8px 12px',
            transition: 'all 0.2s ease-in-out',
            cursor: finalIsEditable ? 'text' : 'not-allowed',
            opacity: finalIsEditable ? 1 : 0.7,
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isNumeric ? 'flex-end' : 'flex-start',
            textAlign: isNumeric ? 'right' : 'left',
            position: 'relative',
            outline: isSelected ? '2px solid #0078d4' : 'none',
            outlineOffset: '-1px',
            boxShadow: isAnchor ? 'inset 0 0 0 2px #0078d4' : 'none'
        };

        // Add fill direction class if this is the last cell in the fill preview
        let fillDirectionClass = '';
        if (isInFillPreview && this.state.fillDirection && this.state.fillPreviewRange) {
            // Use helper to properly split cell key
            const { recordId, columnName } = this.splitCellKey(cellKey);
            const rowIndex = this.state.currentData.findIndex(r => r.id === recordId);
            const colIndex = this.state.columns.findIndex(c => c.key === columnName);

            const isLastCell = (
                (this.state.fillDirection === 'down' && rowIndex === this.state.fillPreviewRange.endRow) ||
                (this.state.fillDirection === 'up' && rowIndex === this.state.fillPreviewRange.startRow)
            );

            if (isLastCell) {
                fillDirectionClass = `fill-direction-${this.state.fillDirection}`;
            }
        }

        const cellClassName = `custom-data-cell ${finalIsEditable
            ? (isChanged ? 'changed-cell' : 'editable-cell')
            : 'readonly-cell'} ${isSelected ? 'selected-cell' : ''} ${isAnchor ? 'anchor-cell' : ''} ${isInFillPreview ? 'fill-preview-cell' : ''} ${fillDirectionClass}`;

        const ariaLabel = finalIsEditable
            ? `Edit ${displayName} for record ${item.id}${isChanged ? ' (modified)' : ''}`
            : `${displayName}: ${value} (read-only: ${readOnlyReason})`;

        // Debug: Log when rendering cells with selection state
        if (isSelected || isAnchor) {
            console.log('[RENDER_CELL] Rendering cell with selection', {
                cellKey,
                isSelected,
                isAnchor,
                columnName,
                recordId: item.id
            });
        }

        if (!finalIsEditable && isEditable) {
            logger.error(LogTag.READONLY, `SAFETY CHECK: Field "${columnName}" was marked editable but is in read-only set. Forcing to read-only.`);
        }

        // Handler to prevent interaction with read-only cells ONLY
        const handleCellClick = (e: React.MouseEvent) => {
            if (!finalIsEditable) {
                e.preventDefault();
                e.stopPropagation();
                logger.warn(LogTag.READONLY, `Blocked click on read-only field: "${columnName}"`);
            }
            // For editable cells, don't prevent default - let the TextField handle it
        };

        const handleCellFocus = (e: React.FocusEvent) => {
            if (!finalIsEditable) {
                e.preventDefault();
                e.stopPropagation();
                (e.target as HTMLElement).blur();
                logger.warn(LogTag.READONLY, `Blocked focus on read-only field: "${columnName}"`);
            }
        };

        return (
            <div
                style={cellStyle}
                className={cellClassName}
                tabIndex={finalIsEditable ? 0 : -1}
                role="gridcell"
                aria-label={ariaLabel}
                data-cell-id={cellKey}
                data-record-id={item.id}
                data-column-name={columnName}
                onClick={handleCellClick}
                onFocus={handleCellFocus}
                onMouseDown={(e) => this.handleCellMouseDown(e, item.id, columnName)}
                onMouseEnter={(e) => this.handleCellMouseEnter(e, item.id, columnName)}
            >
                {this.props.enableChangeTracking && this.props.showChangeIndicator && isChanged && (
                    <span className="change-indicator" aria-label="Modified">*</span>
                )}
                {finalIsEditable ? (
                    <TextField
                        value={value}
                        onChange={(e, newValue) => this.handleCellChange(item.id, columnName, newValue)}
                        readOnly={false}
                        disabled={false}
                        borderless
                        ariaLabel={`Edit ${displayName}`}
                        onMouseDown={(e) => {
                            // Allow cell selection when clicking on the TextField
                            this.handleCellMouseDown(e as any, item.id, columnName);
                        }}
                        styles={{
                            root: { display: 'inline-block', width: '100%' },
                            fieldGroup: {
                                border: 'none',
                                background: 'transparent',
                                textAlign: isNumeric ? 'right' : 'left'
                            },
                            field: {
                                textAlign: isNumeric ? 'right' : 'left'
                            }
                        }}
                    />
                ) : (
                    <span
                        className="readonly-text"
                        title={`This field is read-only: ${readOnlyReason}`}
                        role="text"
                        style={{
                            color: '#605e5c',
                            fontStyle: 'italic',
                            textAlign: isNumeric ? 'right' : 'left',
                            width: '100%',
                            display: 'block'
                        }}
                    >
                        {value}
                    </span>
                )}
                {/* Add fill handle for anchor cell */}
                {isAnchor && (
                    <FillHandle
                        visible={true}
                        onDragStart={this.handleFillDragStart}
                    />
                )}
            </div>
        );
    }

    private handleCellChange = (recordId: string, columnName: string, newValue: any): void => {
        // CRITICAL CHECK: Prevent changes to read-only fields at the handler level (CASE-INSENSITIVE)
        if (this.state.readOnlyFieldsSet.has(columnName.toLowerCase())) {
            logger.error(LogTag.READONLY, `Attempted to edit read-only field: "${columnName}". Change blocked.`, undefined, {
                recordId,
                columnName,
                normalizedColumnName: columnName.toLowerCase(),
                attemptedValue: newValue
            });
            // Do not process the change
            return;
        }

        // Additional check: Verify field is editable
        if (!this.isFieldEditable(columnName)) {
            logger.error(LogTag.READONLY, `Attempted to edit non-editable field: "${columnName}". Change blocked.`, undefined, {
                recordId,
                columnName,
                normalizedColumnName: columnName.toLowerCase(),
                attemptedValue: newValue
            });
            // Do not process the change
            return;
        }

        // Get column metadata to determine the proper data type
        const columnMetadata = getColumnMetadata(this.props.dataset, columnName);
        const dataType = columnMetadata?.dataType;

        // Convert the value based on the column's actual data type
        const processedValue = convertValueByDataType(newValue, dataType, columnName);

        // If processedValue is undefined, it means this field should not be updated
        if (processedValue === undefined) {
            console.warn(`[GridComponent] Field ${columnName} cannot be updated directly. Skipping.`);
            // Reset the field value to its original
            this.setState((prevState) => ({
                currentData: prevState.currentData
            }));
            return;
        }

        console.log(`[GridComponent] Cell change for ${columnName}:`, {
            originalValue: newValue,
            originalType: typeof newValue,
            processedValue,
            processedType: typeof processedValue,
            columnDataType: dataType
        });

        // Update current data
        const updatedCurrentData = this.state.currentData.map(record =>
            record.id === recordId
                ? { ...record, [columnName]: processedValue }
                : record
        );

        // Track the change with the processed value
        this.changeTracker.trackChange(recordId, columnName, processedValue);

        // Notify parent component with the processed value
        this.debouncedNotifyChange(recordId, columnName, processedValue);

        this.setState({
            currentData: updatedCurrentData
        }, () => {
            // Recalculate aggregations
            this.calculateAggregations();
        });
    }

    private handleSave = async (): Promise<void> => {
        this.setState({
            isSaving: true,
            errorMessage: null,
            successMessage: null
        });

        try {
            await this.props.onSave();

            // Clear changes after successful save
            this.changeTracker.clearChanges();

            // Reload data to get latest from server
            this.loadData();

            this.setState({
                isSaving: false,
                successMessage: 'Changes saved successfully!'
            });

            // Clear success message after 3 seconds
            if (this.successMessageTimer) {
                clearTimeout(this.successMessageTimer);
            }
            this.successMessageTimer = setTimeout(() => {
                this.setState({ successMessage: null });
            }, 3000);
        } catch (error) {
            console.error('Error saving changes:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.setState({
                isSaving: false,
                errorMessage: `Failed to save changes: ${errorMessage}`
            });
        }
    }

    private handleDiscard = (): void => {
        // Reload original data
        this.loadData();
    }

    // ============ Cell Selection Methods for Drag-Fill ============

    /**
     * Helper method to properly split cell keys
     * Handles column names that contain underscores
     * Cell key format: {recordId}_{columnName}
     * Where recordId is a GUID (36 chars) and columnName can contain underscores
     */
    private splitCellKey = (cellKey: string): { recordId: string; columnName: string } => {
        // GUIDs are always 36 characters long
        // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        // So the separator underscore is at position 36
        const recordId = cellKey.substring(0, 36);
        const columnName = cellKey.substring(37); // Skip the underscore at position 36

        // Debug logging to understand parsing
        console.log('[SPLIT_CELL_KEY] Parsing cell key', {
            cellKey,
            cellKeyLength: cellKey.length,
            recordId,
            recordIdLength: recordId.length,
            columnName,
            columnNameLength: columnName.length,
            underscoreAt36: cellKey.charAt(36)
        });

        return { recordId, columnName };
    }

    /**
     * Select a single cell for drag-fill operations
     */
    private selectCell = (recordId: string, columnName: string): void => {
        const cellKey = `${recordId}_${columnName}`;

        // Check if cell is editable before allowing selection
        const record = this.state.currentData.find(r => r.id === recordId);
        const column = this.state.columns.find(c => c.key === columnName);

        if (!record || !this.isFieldEditable(columnName, record)) {
            logger.debug(LogTag.RENDER, `Cannot select read-only cell: ${cellKey}`);
            return; // Cannot select read-only cells
        }

        console.log('[CELL_SELECTION] Selecting cell', {
            cellKey,
            columnName,
            isReadOnly: !this.isFieldEditable(columnName)
        });

        this.setState({
            selectedCells: new Set([cellKey]),
            anchorCell: cellKey,
            selectionRange: null
        }, () => {
            // Log state after update
            console.log('[CELL_SELECTION] Selection state updated', {
                anchorCell: this.state.anchorCell,
                selectedCells: Array.from(this.state.selectedCells)
            });
        });
    }

    /**
     * Select a range of cells (Shift+Click functionality)
     */
    private selectRange = (fromCell: string, toCell: string): void => {
        // Use helper to properly split cell keys
        const { recordId: fromRecordId, columnName: fromColumn } = this.splitCellKey(fromCell);
        const { recordId: toRecordId, columnName: toColumn } = this.splitCellKey(toCell);

        // Calculate range bounds
        const fromRowIndex = this.state.currentData.findIndex(r => r.id === fromRecordId);
        const toRowIndex = this.state.currentData.findIndex(r => r.id === toRecordId);
        const fromColIndex = this.state.columns.findIndex(c => c.key === fromColumn);
        const toColIndex = this.state.columns.findIndex(c => c.key === toColumn);

        const range = {
            startRow: Math.min(fromRowIndex, toRowIndex),
            endRow: Math.max(fromRowIndex, toRowIndex),
            startCol: Math.min(fromColIndex, toColIndex),
            endCol: Math.max(fromColIndex, toColIndex)
        };

        // Build selected cells set (only editable cells)
        const selectedCells = new Set<string>();
        for (let r = range.startRow; r <= range.endRow; r++) {
            for (let c = range.startCol; c <= range.endCol; c++) {
                const record = this.state.currentData[r];
                const column = this.state.columns[c];

                if (record && column && this.isFieldEditable(column.key, record)) {
                    selectedCells.add(`${record.id}_${column.key}`);
                }
            }
        }

        this.setState({
            selectedCells,
            selectionRange: range
        });
    }

    /**
     * Handle mouse down on a cell for selection
     */
    private handleCellMouseDown = (e: React.MouseEvent, recordId: string, columnName: string): void => {
        console.log('[CELL_MOUSE_DOWN] Mouse down event triggered', {
            recordId,
            columnName,
            target: (e.target as HTMLElement).tagName,
            className: (e.target as HTMLElement).className
        });

        // Don't interfere with clicking on the TextField itself
        const target = e.target as HTMLElement;
        const isTextField = target.tagName === 'INPUT' || target.closest('.ms-TextField');

        if (isTextField) {
            console.log('[CELL_MOUSE_DOWN] Clicked on TextField input, selecting cell');
            // Let the TextField handle the click normally
            // But still select the cell
            this.selectCell(recordId, columnName);
            return;
        }

        const cellKey = `${recordId}_${columnName}`;

        if (e.shiftKey && this.state.anchorCell) {
            // Prevent default only for shift+click to avoid text selection
            e.preventDefault();
            // Shift+Click for range selection
            this.selectRange(this.state.anchorCell, cellKey);
        } else {
            console.log('[CELL_MOUSE_DOWN] Regular click (not shift), selecting single cell');
            // Regular click for single cell selection
            this.selectCell(recordId, columnName);
            // Focus the input field if it's editable
            const record = this.state.currentData.find(r => r.id === recordId);
            if (record && this.isFieldEditable(columnName, record)) {
                // Use setTimeout to ensure the selection state is updated first
                setTimeout(() => {
                    const cellElement = e.currentTarget as HTMLElement;
                    const input = cellElement.querySelector('input');
                    if (input) {
                        input.focus();
                    }
                }, 0);
            }
        }
    }

    /**
     * Handle mouse enter on a cell (for drag selection)
     */
    private handleCellMouseEnter = (e: React.MouseEvent, recordId: string, columnName: string): void => {
        // Only process if mouse button is down (dragging)
        if (e.buttons === 1 && this.state.anchorCell && !this.state.isDraggingFill) {
            const cellKey = `${recordId}_${columnName}`;
            this.selectRange(this.state.anchorCell, cellKey);
        }
    }

    /**
     * Check if a cell is in the fill preview range
     */
    private isCellInFillPreview = (cellKey: string): boolean => {
        if (!this.state.fillPreviewRange) return false;

        // Use helper to properly split cell key
        const { recordId, columnName } = this.splitCellKey(cellKey);
        const rowIndex = this.state.currentData.findIndex(r => r.id === recordId);
        const colIndex = this.state.columns.findIndex(c => c.key === columnName);

        return rowIndex >= this.state.fillPreviewRange.startRow &&
               rowIndex <= this.state.fillPreviewRange.endRow &&
               colIndex >= this.state.fillPreviewRange.startCol &&
               colIndex <= this.state.fillPreviewRange.endCol;
    }

    /**
     * Get the position for the fill handle
     */
    private getFillHandlePosition = (cellKey: string): { x: number; y: number } | null => {
        // This will be calculated based on the cell's DOM element position
        // For now, return null - will be implemented when we update the render method
        return this.state.fillHandlePosition;
    }

    /**
     * Handle fill handle drag start
     */
    private handleFillDragStart = (e: React.MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        // Debug logging
        console.log('[DRAG_FILL] Starting drag operation', {
            anchorCell: this.state.anchorCell,
            selectedCells: Array.from(this.state.selectedCells),
            mousePosition: { x: e.clientX, y: e.clientY }
        });

        // Ensure we have an anchor cell
        if (!this.state.anchorCell) {
            console.warn('[DRAG_FILL] No anchor cell set, cannot start drag');
            return;
        }

        this.setState({
            isDraggingFill: true
        });

        // Add cursor class to body
        document.body.classList.add('is-dragging-fill');

        // Add mouse move and mouse up listeners for drag operation
        document.addEventListener('mousemove', this.handleFillDragMove);
        document.addEventListener('mouseup', this.handleFillDragEnd);

        console.log('[DRAG_FILL] Event listeners added for drag operation');
    }

    /**
     * Handle fill drag move - restricted to vertical movement only
     */
    private handleFillDragMove = (e: MouseEvent): void => {
        if (!this.state.isDraggingFill || !this.state.anchorCell) {
            console.log('[DRAG_FILL] Move ignored - not dragging or no anchor', {
                isDraggingFill: this.state.isDraggingFill,
                anchorCell: this.state.anchorCell
            });
            return;
        }

        // Find the cell under the cursor
        const element = document.elementFromPoint(e.clientX, e.clientY);
        if (!element) {
            console.log('[DRAG_FILL] No element at cursor position');
            return;
        }

        const cellElement = element.closest('.custom-data-cell');
        if (!cellElement) {
            console.log('[DRAG_FILL] No cell element found at cursor position');
            return;
        }

        // Extract cell info from the element (we'll add data attributes in renderCell)
        const recordId = cellElement.getAttribute('data-record-id');
        const columnName = cellElement.getAttribute('data-column-name');

        console.log('[DRAG_FILL] Mouse move over cell', {
            recordId,
            columnName,
            cellElement: cellElement.className
        });

        if (recordId && columnName) {
            const targetCellKey = `${recordId}_${columnName}`;

            // Calculate fill preview range
            // Use helper to properly split cell key
            const { recordId: anchorRecordId, columnName: anchorColumnName } = this.splitCellKey(this.state.anchorCell);

            console.log('[DRAG_FILL] Anchor cell parsing', {
                anchorCell: this.state.anchorCell,
                anchorRecordId,
                anchorColumnName,
                targetColumnName: columnName
            });

            const anchorRowIndex = this.state.currentData.findIndex(r => r.id === anchorRecordId);
            const anchorColIndex = this.state.columns.findIndex(c => c.key === anchorColumnName);

            const targetRowIndex = this.state.currentData.findIndex(r => r.id === recordId);
            const targetColIndex = this.state.columns.findIndex(c => c.key === columnName);

            // Determine fill direction - VERTICAL ONLY (up/down in the same column)
            let fillDirection: 'down' | 'up' | 'left' | 'right' | null = null;

            // Only allow vertical drag in the same column
            if (targetColIndex === anchorColIndex) {
                if (targetRowIndex > anchorRowIndex) {
                    fillDirection = 'down';
                } else if (targetRowIndex < anchorRowIndex) {
                    fillDirection = 'up';
                }
            }
            // Horizontal drag is not allowed - fillDirection remains null

            console.log('[DRAG_FILL] Fill direction calculation', {
                anchorPosition: { row: anchorRowIndex, col: anchorColIndex },
                targetPosition: { row: targetRowIndex, col: targetColIndex },
                fillDirection,
                isSameColumn: targetColIndex === anchorColIndex
            });

            // Update fill preview only for vertical drag
            if (fillDirection) {
                const fillRange = {
                    startRow: Math.min(anchorRowIndex, targetRowIndex),
                    startCol: anchorColIndex,  // Keep column constant
                    endRow: Math.max(anchorRowIndex, targetRowIndex),
                    endCol: anchorColIndex      // Keep column constant
                };

                console.log('[DRAG_FILL] Setting fill preview', {
                    fillRange,
                    fillDirection,
                    cellsInRange: (fillRange.endRow - fillRange.startRow + 1)
                });

                this.setState({
                    fillPreviewRange: fillRange,
                    fillDirection
                });
            } else {
                console.log('[DRAG_FILL] Clearing preview - not vertical drag');
                // Clear preview if dragging horizontally or diagonally
                this.setState({
                    fillPreviewRange: null,
                    fillDirection: null
                });
            }
        }
    }

    /**
     * Execute the fill operation after drag ends
     */
    private executeFillOperation = (): void => {
        if (!this.state.fillPreviewRange || !this.state.anchorCell) return;

        const { fillPreviewRange, currentData, columns } = this.state;

        // Get source value from the anchor cell
        // Use helper to properly split cell key
        const { recordId: sourceRecordId, columnName: sourceColumnKey } = this.splitCellKey(this.state.anchorCell);
        const sourceRecord = currentData.find(r => r.id === sourceRecordId);
        const sourceColumn = columns.find(c => c.key === sourceColumnKey);

        if (!sourceRecord || !sourceColumn) return;

        const sourceValue = sourceRecord[sourceColumnKey];
        const dataType = sourceColumn.data?.dataType || 'SingleLine.Text';

        // Calculate cells to fill vertically (excluding source cell and read-only cells)
        const cellsToFill: { record: any; column: IColumn }[] = [];

        for (let row = fillPreviewRange.startRow; row <= fillPreviewRange.endRow; row++) {
            for (let col = fillPreviewRange.startCol; col <= fillPreviewRange.endCol; col++) {
                const record = currentData[row];
                const column = columns[col];

                if (!record || !column) continue;

                const cellKey = `${record.id}_${column.key}`;

                // Skip if:
                // 1. Cell is the source cell
                // 2. Cell is not editable
                if (cellKey === this.state.anchorCell || !this.isFieldEditable(column.key, record)) {
                    continue;
                }

                cellsToFill.push({ record, column });
            }
        }

        if (cellsToFill.length === 0) {
            log(LogTag.DRAG_FILL, 'No editable cells to fill');
            return;
        }

        // Generate fill values (simply copy the source value)
        const fillValues = VerticalFillHelper.generateFillValues(sourceValue, cellsToFill.length);

        // Apply fill values
        const updatedData = [...currentData];
        let changesMade = false;

        for (let i = 0; i < cellsToFill.length; i++) {
            const { record, column } = cellsToFill[i];
            const newValue = fillValues[i];  // This will be the same source value for all

            // Convert value based on data type
            const convertedValue = convertValueByDataType(newValue, column.data?.dataType, column.key);

            // Find record in updatedData and update
            const recordIndex = updatedData.findIndex(r => r.id === record.id);
            if (recordIndex !== -1) {
                // Update the record
                updatedData[recordIndex] = {
                    ...updatedData[recordIndex],
                    [column.key]: convertedValue
                };

                // Track the change
                this.changeTracker.trackChange(record.id, column.key, convertedValue);

                // Notify parent component immediately (not debounced) for bulk fill operations
                // Using debounce here would cause only the last cell to be saved
                this.props.onCellChange(record.id, column.key, convertedValue);

                changesMade = true;

                log(LogTag.DRAG_FILL, `Filled cell ${record.id}_${column.key} with value:`, { value: convertedValue });
            }
        }

        // Update state if changes were made
        if (changesMade) {
            this.setState(
                { currentData: updatedData },
                () => {
                    // Recalculate aggregations if enabled
                    if (this.props.aggregationMode && Number(this.props.aggregationMode) !== Number(AggregationMode.None)) {
                        this.calculateAggregations();
                    }
                }
            );
        }

        // Clear selection after fill operation
        this.clearSelection();
    }

    /**
     * Handle fill drag end
     */
    private handleFillDragEnd = (e: MouseEvent): void => {
        console.log('[DRAG_FILL] Drag ending', {
            isDraggingFill: this.state.isDraggingFill,
            fillPreviewRange: this.state.fillPreviewRange,
            fillDirection: this.state.fillDirection
        });

        if (!this.state.isDraggingFill) return;

        // Remove cursor class from body
        document.body.classList.remove('is-dragging-fill');

        // Remove event listeners
        document.removeEventListener('mousemove', this.handleFillDragMove);
        document.removeEventListener('mouseup', this.handleFillDragEnd);

        // Execute the fill operation if we have a valid preview range
        if (this.state.fillPreviewRange && this.state.fillDirection) {
            console.log('[DRAG_FILL] Executing fill operation');
            this.executeFillOperation();
        } else {
            console.log('[DRAG_FILL] No valid fill range, skipping fill operation');
        }

        // Reset fill state
        this.setState({
            isDraggingFill: false,
            fillPreviewRange: null,
            fillDirection: null
        });
    }

    /**
     * Clear the current selection
     */
    private clearSelection = (): void => {
        this.setState({
            selectedCells: new Set(),
            anchorCell: null,
            selectionRange: null,
            fillPreviewRange: null,
            isDraggingFill: false,
            fillDirection: null
        });
    }

    /**
     * Setup keyboard shortcut handlers
     */
    private setupKeyboardHandlers = (): void => {
        this.keyboardManager.setActionHandlers({
            fillDown: () => this.executeFillDown(),
            save: () => this.handleSave(),
            selectAll: () => this.selectAllEditableCells()
        });
    }

    /**
     * Handle keyboard events
     */
    private handleKeyDown = (event: KeyboardEvent): void => {
        // Don't handle shortcuts if user is typing in an input field
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            return;
        }

        // Let the keyboard manager handle the event
        this.keyboardManager.handleKeyDown(event);
    }

    /**
     * Execute fill down operation from keyboard shortcut (Ctrl+D)
     */
    private executeFillDown = (): void => {
        if (!this.state.anchorCell) {
            log(LogTag.DRAG_FILL, 'No cell selected for fill down operation');
            return;
        }

        // Find the next editable cell below the anchor cell
        // Use helper to properly split cell key
        const { recordId: anchorRecordId, columnName: anchorColumnKey } = this.splitCellKey(this.state.anchorCell);
        const anchorRowIndex = this.state.currentData.findIndex(r => r.id === anchorRecordId);
        const anchorColIndex = this.state.columns.findIndex(c => c.key === anchorColumnKey);

        if (anchorRowIndex === -1 || anchorColIndex === -1) return;

        // Find the range to fill (from anchor cell to the last row or next non-editable cell)
        let endRowIndex = anchorRowIndex;
        for (let i = anchorRowIndex + 1; i < this.state.currentData.length; i++) {
            const record = this.state.currentData[i];
            const column = this.state.columns[anchorColIndex];
            if (this.isFieldEditable(column.key, record)) {
                endRowIndex = i;
            } else {
                break; // Stop at first non-editable cell
            }
        }

        // If there are cells to fill below
        if (endRowIndex > anchorRowIndex) {
            // Set up the fill preview range
            this.setState({
                fillPreviewRange: {
                    startRow: anchorRowIndex,
                    endRow: endRowIndex,
                    startCol: anchorColIndex,
                    endCol: anchorColIndex
                },
                fillDirection: 'down'
            }, () => {
                // Execute the fill operation
                this.executeFillOperation();
            });
        } else {
            log(LogTag.DRAG_FILL, 'No editable cells below to fill');
        }
    }

    /**
     * Select all editable cells in the grid
     */
    private selectAllEditableCells = (): void => {
        const allEditableCells = new Set<string>();
        this.state.currentData.forEach(record => {
            this.state.columns.forEach(column => {
                if (this.isFieldEditable(column.key, record)) {
                    allEditableCells.add(`${record.id}_${column.key}`);
                }
            });
        });
        this.setState({ selectedCells: allEditableCells });
        log(LogTag.KEYBOARD, `Selected ${allEditableCells.size} editable cells`);
    }

    render(): JSX.Element {
        const { isLoading, isSaving, errorMessage, successMessage, currentData } = this.state;
        const changedCount = this.changeTracker.getChangedCellsCount();
        const hasChanges = changedCount > 0;

        if (isLoading) {
            return (
                <div className="loading-spinner">
                    <Spinner size={SpinnerSize.large} label="Loading data..." />
                </div>
            );
        }

        const columns = this.buildColumns();

        return (
            <div className="grid-change-tracker-container">
                <div className="grid-change-tracker-header">
                    <div className="grid-change-tracker-title">
                        {this.props.dataset.getTitle() || 'Grid Change Tracker'}
                        <span className="deployment-timestamp" title="Last deployment">
                            v{BUILD_TIMESTAMP}
                        </span>
                    </div>
                    <div className="grid-change-tracker-actions">
                        {hasChanges && (
                            <div className="status-indicator">
                                <span className="changes-count">
                                    {changedCount} {changedCount === 1 ? 'change' : 'changes'}
                                </span>
                            </div>
                        )}
                        <DefaultButton
                            text="Discard"
                            onClick={this.handleDiscard}
                            disabled={!hasChanges || isSaving}
                            ariaLabel={`Discard ${changedCount} pending changes`}
                            title="Discard all changes and reload original data"
                        />
                        <PrimaryButton
                            text={isSaving ? 'Saving...' : 'Save Changes'}
                            onClick={this.handleSave}
                            disabled={!hasChanges || isSaving}
                            className="save-button"
                            ariaLabel={isSaving ? 'Saving changes' : `Save ${changedCount} pending changes`}
                            title={isSaving ? 'Saving changes to server' : 'Save all changes to server'}
                        />
                    </div>
                </div>

                {errorMessage && (
                    <MessageBar
                        messageBarType={MessageBarType.error}
                        onDismiss={() => this.setState({ errorMessage: null })}
                        className="error-message"
                    >
                        {errorMessage}
                    </MessageBar>
                )}

                {successMessage && (
                    <MessageBar
                        messageBarType={MessageBarType.success}
                        onDismiss={() => this.setState({ successMessage: null })}
                        className="success-message"
                    >
                        {successMessage}
                    </MessageBar>
                )}

                <div className="grid-content">
                    {/* Custom sticky header with filters */}
                    {this.renderCustomHeader()}

                    {/* Custom data rows - no DetailsList */}
                    <div className="grid-body" ref={this.bodyRef}>
                        {this.renderCustomRows()}
                    </div>
                </div>

                <AggregationFooter
                    aggregations={this.state.aggregations}
                    columns={this.props.dataset.columns}
                    mode={getAggregationMode(this.props.aggregationMode)}
                    gridColumns={columns}
                />
            </div>
        );
    }
}
