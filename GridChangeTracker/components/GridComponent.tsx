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
import { BUILD_TIMESTAMP } from '../buildConstants';
import { debounce } from '../utils/debounce';
import { getColumnDescriptions, defaultColumnDescriptions } from '../utils/metadataConfig';
import { convertValueByDataType, getColumnMetadata, isFieldEditableByType } from '../utils/typeConverter';

export interface IGridProps {
    dataset: ComponentFramework.PropertyTypes.DataSet;
    enableChangeTracking: boolean;
    changedCellColor: string;
    aggregationMode: number;
    showChangeIndicator: boolean;
    readOnlyFields: string;
    useDescriptionAsColumnName: boolean;
    onCellChange: (recordId: string, columnName: string, value: any) => void;
    onSave: () => Promise<void>;
    // Add context to access WebAPI
    context?: ComponentFramework.Context<any>;
}

interface IGridState {
    currentData: any[];
    filteredData: any[];
    isLoading: boolean;
    isSaving: boolean;
    errorMessage: string | null;
    successMessage: string | null;
    aggregations: AggregationResult;
    sortColumn: string | null;
    isSortDescending: boolean;
    columnFilters: { [key: string]: string };
    columns: IColumn[];
    readOnlyFieldsSet: Set<string>;
}

export class GridComponent extends React.Component<IGridProps, IGridState> {
    private changeTracker: ChangeTracker;
    private successMessageTimer?: NodeJS.Timeout;
    private debouncedNotifyChange: (recordId: string, columnName: string, value: any) => void;
    private columnDescriptions = new Map<string, string>();
    private entityMetadata = new Map<string, { isValidForUpdate: boolean; attributeType: string }>();
    private pageSizeSet = false; // Flag to track if we've set the max page size
    private headerRef = React.createRef<HTMLDivElement>();
    private bodyRef = React.createRef<HTMLDivElement>();

    constructor(props: IGridProps) {
        super(props);

        this.changeTracker = new ChangeTracker();

        // Debounce cell change notifications to reduce rapid updates
        this.debouncedNotifyChange = debounce((recordId: string, columnName: string, value: any) => {
            this.props.onCellChange(recordId, columnName, value);
        }, 300);

        this.state = {
            currentData: [],
            filteredData: [],
            isLoading: true,
            isSaving: false,
            errorMessage: null,
            successMessage: null,
            aggregations: {},
            sortColumn: null,
            isSortDescending: false,
            columnFilters: {},
            columns: [],
            readOnlyFieldsSet: this.parseReadOnlyFields(props.readOnlyFields)
        };
    }

    componentDidMount(): void {
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

        console.log('[GridComponent] setMaxPageSize() called, pageSizeSet flag:', this.pageSizeSet);

        // Only set page size once to avoid infinite loops
        if (this.pageSizeSet) {
            console.log('[GridComponent] Page size already set, skipping');
            return false;
        }

        // Check if dataset and paging are available
        if (dataset && dataset.paging) {
            const currentPageSize = dataset.paging.pageSize;
            const totalCount = dataset.paging.totalResultCount;

            console.log(`[GridComponent] Paging info - Current pageSize: ${currentPageSize}, Total records: ${totalCount}, hasNextPage: ${dataset.paging.hasNextPage}`);

            // Set page size to 5000 (maximum allowed by Dataverse)
            // This will load all records up to 5000 in a single page
            if (currentPageSize < 5000) {
                console.log(`[GridComponent] Setting page size from ${currentPageSize} to 5000`);
                dataset.paging.setPageSize(5000);
                console.log(`[GridComponent] Page size after setting: ${dataset.paging.pageSize}`);

                // Mark that we've set the page size
                this.pageSizeSet = true;

                // Refresh the dataset to load all records with the new page size
                console.log(`[GridComponent] Calling dataset.refresh() to reload with new page size`);
                dataset.refresh();

                // Return true to indicate we triggered a refresh
                return true;
            } else {
                console.log(`[GridComponent] Page size already at maximum (${currentPageSize})`);
                this.pageSizeSet = true;
            }
        } else {
            console.warn('[GridComponent] Cannot set page size - paging not available!', {
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
            return new Set<string>();
        }

        // Split by comma and trim whitespace
        const fields = readOnlyFieldsString
            .split(',')
            .map(field => field.trim())
            .filter(field => field.length > 0);

        return new Set<string>(fields);
    }

    private isFieldEditable(columnName: string): boolean {
        // Check if field is in the read-only configuration
        if (this.state.readOnlyFieldsSet.has(columnName)) {
            console.log(`[GridComponent] Field ${columnName} is in read-only configuration`);
            return false;
        }

        // Check column metadata for any indicators
        const column = this.props.dataset.columns.find(col => col.name === columnName);
        if (!column) {
            return false;
        }

        // Check if column is the primary field (usually read-only)
        if (column.isPrimary) {
            console.log(`[GridComponent] Field ${columnName} is primary field - not editable`);
            return false;
        }

        // FIRST: Check the real metadata from Dataverse API (if loaded)
        const realMetadata = this.entityMetadata.get(columnName);
        if (realMetadata) {
            // Use the authoritative IsValidForUpdate from the server
            if (realMetadata.isValidForUpdate === false) {
                console.log(`[GridComponent] Field ${columnName} is not valid for update (from server metadata: IsValidForUpdate=false)`);
                return false;
            }

            // Check if it's a Virtual attribute type (from server metadata)
            if (realMetadata.attributeType === 'Virtual') {
                console.log(`[GridComponent] Field ${columnName} is virtual/computed field (from server metadata)`);
                return false;
            }
        }

        // FALLBACK: Get column metadata from PCF dataset (less reliable)
        const columnMetadata = getColumnMetadata(this.props.dataset, columnName);
        if (!columnMetadata) {
            return false;
        }

        // If we don't have real metadata yet, use the PCF dataset metadata as fallback
        if (!realMetadata) {
            // Check if field is marked as not valid for update (from PCF dataset - may be incomplete)
            if (columnMetadata.isValidForUpdate === false) {
                console.log(`[GridComponent] Field ${columnName} is not valid for update (from PCF dataset)`);
                return false;
            }

            // Check if it's a virtual field (from PCF dataset)
            if (columnMetadata.isVirtualField) {
                console.log(`[GridComponent] Field ${columnName} is virtual/computed field - not editable`);
                return false;
            }
        }

        // Check if it's a name field (logical representation of lookup fields)
        // These end with "name" or "yominame" and are display-only
        if (columnMetadata.isNameField) {
            console.log(`[GridComponent] Field ${columnName} is a name field (logical/display-only) - not editable`);
            return false;
        }

        // Check if this field type can be edited in a grid context
        const dataType = columnMetadata.dataType;
        if (!isFieldEditableByType(dataType)) {
            console.log(`[GridComponent] Field ${columnName} with type ${dataType} is not editable in grid`);
            return false;
        }

        // Default to editable
        return true;
    }

    private async loadEntityMetadata(): Promise<void> {
        try {
            const entityType = this.props.dataset.getTargetEntityType();
            if (!entityType) {
                console.warn('[GridComponent] Unable to load entity metadata: No entity type available');
                return;
            }

            console.log(`[GridComponent] Loading entity metadata for: ${entityType}`);

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
                filteredData: records,
                isLoading: false,
                errorMessage: null,
                sortColumn: null,
                isSortDescending: false,
                columnFilters: {},
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
            this.state.filteredData,
            this.props.dataset.columns,
            mode
        );

        this.setState({ aggregations });
    }

    private handleSort = (column: IColumn): void => {
        const { filteredData, sortColumn, isSortDescending } = this.state;
        const columnName = column.fieldName || column.key;

        // Determine new sort direction
        const newIsSortDescending = sortColumn === columnName ? !isSortDescending : false;

        // Sort the data
        const sortedData = [...filteredData].sort((a, b) => {
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
            filteredData: sortedData,
            sortColumn: columnName,
            isSortDescending: newIsSortDescending
        }, () => {
            this.calculateAggregations();
        });
    }

    private handleFilter = (columnName: string, filterText: string): void => {
        const { currentData, columnFilters } = this.state;

        // Update the filter for this column
        const newFilters = {
            ...columnFilters,
            [columnName]: filterText
        };

        // Apply all filters
        let filtered = [...currentData];
        Object.keys(newFilters).forEach(colName => {
            const filter = newFilters[colName];
            if (filter && filter.trim()) {
                filtered = filtered.filter(item => {
                    const value = String(item[colName] || '').toLowerCase();
                    return value.includes(filter.toLowerCase());
                });
            }
        });

        this.setState({
            filteredData: filtered,
            columnFilters: newFilters,
            sortColumn: null,
            isSortDescending: false
        }, () => {
            this.calculateAggregations();
        });
    }

    private clearFilter = (columnName: string): void => {
        const { columnFilters } = this.state;
        const newFilters = { ...columnFilters };
        delete newFilters[columnName];

        // Reapply all remaining filters
        this.setState({ columnFilters: {} }, () => {
            this.handleFilter(columnName, '');
            this.setState({ columnFilters: newFilters });
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

        const { sortColumn, isSortDescending, columnFilters, columns: stateColumns, filteredData } = this.state;

        // Fixed width for all columns - no dynamic sizing
        const FIXED_COLUMN_WIDTH = 200;

        return this.props.dataset.columns.map(col => {
            const isSorted = sortColumn === col.name;
            const hasFilter = !!columnFilters[col.name];

            // Debug: Log column metadata to verify description availability
            console.log(`[Column ${col.name}]`, {
                displayName: col.displayName,
                description: (col as any).description,
                metadata: (col as any).metadata,
                tooltip: (col as any).tooltip
            });

            // Preserve existing column width if it exists (user has manually resized)
            const existingColumn = stateColumns.find(c => c.key === col.name);

            // Use existing width if column was manually resized, otherwise use fixed width
            const columnWidth = existingColumn?.currentWidth || FIXED_COLUMN_WIDTH;

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
                minWidth: FIXED_COLUMN_WIDTH,
                maxWidth: FIXED_COLUMN_WIDTH,
                currentWidth: columnWidth,
                isResizable: true,
                isSorted: isSorted,
                isSortedDescending: isSorted ? isSortDescending : undefined,
                columnActionsMode: ColumnActionsMode.disabled,
                onRender: (item: any) => this.renderCell(item, col.name),
                flexGrow: 0
            };
        });
    }

    private handleColumnResize = (column?: IColumn, newWidth?: number): void => {
        if (!column || !newWidth) return;

        this.setState(prevState => ({
            columns: prevState.columns.map(col =>
                col.key === column.key
                    ? { ...col, currentWidth: newWidth }
                    : col
            )
        }));
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

                        const headerContent = (
                            <React.Fragment>
                                <span className="column-name">{headerText}</span>
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
                            </React.Fragment>
                        );

                        return (
                            <div
                                key={`header-${columnName}`}
                                className="custom-header-cell"
                                style={{
                                    width: col.currentWidth || col.minWidth,
                                    minWidth: col.minWidth,
                                    maxWidth: col.maxWidth
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
                            </div>
                        );
                    })}
                </div>

                {/* Filter Row */}
                <div className="custom-filter-row">
                    {this.state.columns.map(col => {
                        const columnName = col.key;
                        const filterValue = this.state.columnFilters[columnName] || '';
                        const hasFilter = filterValue.length > 0;
                        const column = this.props.dataset.columns.find(c => c.name === columnName);
                        const headerText = column?.displayName || columnName;

                        return (
                            <div
                                key={`filter-${columnName}`}
                                className="custom-filter-cell"
                                style={{
                                    width: col.currentWidth || col.minWidth,
                                    minWidth: col.minWidth,
                                    maxWidth: col.maxWidth
                                }}
                            >
                                <TextField
                                    placeholder="Filter..."
                                    value={filterValue}
                                    onChange={(e, newValue) => this.handleFilter(columnName, newValue || '')}
                                    ariaLabel={`Filter ${headerText} column`}
                                    styles={{
                                        root: { width: '100%' },
                                        field: { fontSize: 12, padding: '4px 8px', height: 28 }
                                    }}
                                />
                                {hasFilter && (
                                    <Icon
                                        iconName="Cancel"
                                        onClick={() => this.clearFilter(columnName)}
                                        aria-label={`Clear filter on ${headerText}`}
                                        role="button"
                                        tabIndex={0}
                                        styles={{
                                            root: {
                                                cursor: 'pointer',
                                                fontSize: 12,
                                                color: '#605e5c',
                                                position: 'absolute',
                                                right: 8,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                ':hover': { color: '#0078d4' }
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    private renderCustomRows = (): JSX.Element => {
        const { filteredData, columns } = this.state;

        return (
            <div className="custom-data-rows">
                {filteredData.map((item, rowIndex) => (
                    <div key={item.id || rowIndex} className="custom-data-row">
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
                ))}
            </div>
        );
    }

    private renderCell = (item: any, columnName: string): JSX.Element => {
        const isChanged = this.changeTracker.isCellChanged(item.id, columnName);
        const value = item[columnName] || '';
        const isEditable = this.isFieldEditable(columnName);
        const column = this.props.dataset.columns.find(col => col.name === columnName);
        const displayName = column?.displayName || columnName;

        // Get metadata to determine WHY field is not editable (for better UX)
        const columnMetadata = getColumnMetadata(this.props.dataset, columnName);
        let readOnlyReason = '';
        if (!isEditable) {
            if (column?.isPrimary) {
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

        const cellStyle: React.CSSProperties = {
            backgroundColor: isChanged && this.props.enableChangeTracking
                ? this.props.changedCellColor
                : isEditable ? 'transparent' : '#f3f2f1',
            padding: '8px 12px',
            transition: 'all 0.2s ease-in-out',
            cursor: isEditable ? 'text' : 'not-allowed',
            opacity: isEditable ? 1 : 0.7,
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center'
        };

        const cellClassName = isEditable
            ? (isChanged ? 'changed-cell' : 'editable-cell')
            : 'readonly-cell';

        const ariaLabel = isEditable
            ? `Edit ${displayName} for record ${item.id}${isChanged ? ' (modified)' : ''}`
            : `${displayName}: ${value} (read-only: ${readOnlyReason})`;

        return (
            <div style={cellStyle} className={cellClassName} tabIndex={-1} role="gridcell" aria-label={ariaLabel}>
                {this.props.enableChangeTracking && this.props.showChangeIndicator && isChanged && (
                    <span className="change-indicator" aria-label="Modified">*</span>
                )}
                {isEditable ? (
                    <TextField
                        value={value}
                        onChange={(e, newValue) => this.handleCellChange(item.id, columnName, newValue)}
                        borderless
                        ariaLabel={`Edit ${displayName}`}
                        styles={{
                            root: { display: 'inline-block', width: '100%' },
                            fieldGroup: { border: 'none', background: 'transparent' }
                        }}
                    />
                ) : (
                    <span
                        className="readonly-text"
                        title={`This field is read-only: ${readOnlyReason}`}
                        role="text"
                        style={{ color: '#605e5c', fontStyle: 'italic' }}
                    >
                        {value}
                    </span>
                )}
            </div>
        );
    }

    private handleCellChange = (recordId: string, columnName: string, newValue: any): void => {
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
                currentData: prevState.currentData,
                filteredData: prevState.filteredData
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

        // Update filtered data
        const updatedFilteredData = this.state.filteredData.map(record =>
            record.id === recordId
                ? { ...record, [columnName]: processedValue }
                : record
        );

        // Track the change with the processed value
        this.changeTracker.trackChange(recordId, columnName, processedValue);

        // Notify parent component with the processed value
        this.debouncedNotifyChange(recordId, columnName, processedValue);

        this.setState({
            currentData: updatedCurrentData,
            filteredData: updatedFilteredData
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

    render(): JSX.Element {
        const { isLoading, isSaving, errorMessage, successMessage, filteredData, currentData, columnFilters } = this.state;
        const changedCount = this.changeTracker.getChangedCellsCount();
        const hasChanges = changedCount > 0;
        const activeFilterCount = Object.keys(columnFilters).filter(k => columnFilters[k]).length;

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
                        {activeFilterCount > 0 && (
                            <span className="filter-count">
                                ({filteredData.length} of {currentData.length} records)
                            </span>
                        )}
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
