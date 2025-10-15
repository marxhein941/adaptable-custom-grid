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

export interface IGridProps {
    dataset: ComponentFramework.PropertyTypes.DataSet;
    enableChangeTracking: boolean;
    changedCellColor: string;
    aggregationMode: number;
    showChangeIndicator: boolean;
    readOnlyFields: string;
    onCellChange: (recordId: string, columnName: string, value: any) => void;
    onSave: () => Promise<void>;
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

    constructor(props: IGridProps) {
        super(props);

        this.changeTracker = new ChangeTracker();

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
        this.loadData();
    }

    componentDidUpdate(prevProps: IGridProps): void {
        // Reload data if dataset changes
        if (prevProps.dataset !== this.props.dataset) {
            this.loadData();
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
            return false;
        }

        // Check column metadata for any indicators
        const column = this.props.dataset.columns.find(col => col.name === columnName);
        if (!column) {
            return false;
        }

        // Check if column is the primary field (usually read-only)
        if (column.isPrimary) {
            return false;
        }

        // Default to editable
        return true;
    }

    private loadData = (): void => {
        try {
            const records = this.loadRecordsFromDataset(this.props.dataset);
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
            return [];
        }

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
        // Base width calculation factors (reduced by 50%)
        const CHAR_WIDTH = 3; // Average character width in pixels (was 6)
        const PADDING = -5; // Cell padding + borders (was -10)
        const MIN_WIDTH = 10; // Reduced by 50% (was 20)
        const MAX_WIDTH = 100; // Reduced by 50% (was 200)
        const HEADER_EXTRA = 8; // Extra space for sort icon, filter, dropdown (was 15)

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

        return this.props.dataset.columns.map(col => {
            const isSorted = sortColumn === col.name;
            const hasFilter = !!columnFilters[col.name];

            // Preserve existing column width if it exists (user has manually resized)
            const existingColumn = stateColumns.find(c => c.key === col.name);

            // Calculate optimal width based on header and content
            const calculatedWidth = this.calculateOptimalColumnWidth(
                col.name,
                col.displayName,
                filteredData
            );

            // Use existing width if column was manually resized, otherwise use calculated
            const columnWidth = existingColumn?.currentWidth || calculatedWidth;

            return {
                key: col.name,
                name: col.displayName,
                fieldName: col.name,
                minWidth: 10,
                maxWidth: 100,
                currentWidth: columnWidth,
                isResizable: true,
                isSorted: isSorted,
                isSortedDescending: isSorted ? isSortDescending : undefined,
                columnActionsMode: ColumnActionsMode.hasDropdown,
                onColumnClick: (ev, column) => this.handleSort(column),
                onRender: (item: any) => this.renderCell(item, col.name),
                onRenderHeader: () => this.renderColumnHeader(col.name, hasFilter),
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

    private renderColumnHeader = (columnName: string, hasFilter: boolean): JSX.Element => {
        const filterValue = this.state.columnFilters[columnName] || '';
        const column = this.props.dataset.columns.find(col => col.name === columnName);
        const displayName = column?.displayName || columnName;
        const description = (column as any)?.description || '';

        // Use description if available, otherwise fall back to display name
        const tooltipContent = description || displayName;

        const titleContent = (
            <div className="column-header-title">
                {displayName}
            </div>
        );

        return (
            <div className="column-header-container">
                <TooltipHost
                    content={tooltipContent}
                    id={`tooltip-${columnName}`}
                    calloutProps={{
                        gapSpace: 0,
                        beakWidth: 8
                    }}
                    styles={{
                        root: { display: 'block' }
                    }}
                >
                    {titleContent}
                </TooltipHost>
                <div className="column-filter" onClick={(e) => e.stopPropagation()}>
                    <TextField
                        placeholder="Filter..."
                        value={filterValue}
                        onChange={(e, newValue) => this.handleFilter(columnName, newValue || '')}
                        styles={{
                            root: { marginTop: 4 },
                            field: { fontSize: 12, padding: '2px 4px' }
                        }}
                        iconProps={hasFilter ? { iconName: 'Filter', style: { color: '#0078d4' } } : undefined}
                    />
                    {hasFilter && (
                        <Icon
                            iconName="Cancel"
                            onClick={() => this.clearFilter(columnName)}
                            styles={{
                                root: {
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    color: '#605e5c',
                                    marginLeft: 4,
                                    ':hover': { color: '#0078d4' }
                                }
                            }}
                        />
                    )}
                </div>
            </div>
        );
    }

    private renderCell = (item: any, columnName: string): JSX.Element => {
        const isChanged = this.changeTracker.isCellChanged(item.id, columnName);
        const value = item[columnName] || '';
        const isEditable = this.isFieldEditable(columnName);

        const cellStyle: React.CSSProperties = {
            backgroundColor: isChanged && this.props.enableChangeTracking
                ? this.props.changedCellColor
                : isEditable ? 'transparent' : '#f3f2f1',
            padding: '2px 4px',
            transition: 'all 0.2s ease-in-out'
        };

        const cellClassName = isEditable
            ? (isChanged ? 'changed-cell' : 'editable-cell')
            : 'readonly-cell';

        return (
            <div style={cellStyle} className={cellClassName} tabIndex={-1}>
                {this.props.enableChangeTracking && this.props.showChangeIndicator && isChanged && (
                    <span className="change-indicator">*</span>
                )}
                {isEditable ? (
                    <TextField
                        value={value}
                        onChange={(e, newValue) => this.handleCellChange(item.id, columnName, newValue)}
                        borderless
                        styles={{
                            root: { display: 'inline-block', width: '100%' },
                            fieldGroup: { border: 'none', background: 'transparent' }
                        }}
                    />
                ) : (
                    <span className="readonly-text" title="This field is read-only">
                        {value}
                    </span>
                )}
            </div>
        );
    }

    private handleCellChange = (recordId: string, columnName: string, newValue: any): void => {
        // Update current data
        const updatedCurrentData = this.state.currentData.map(record =>
            record.id === recordId
                ? { ...record, [columnName]: newValue }
                : record
        );

        // Update filtered data
        const updatedFilteredData = this.state.filteredData.map(record =>
            record.id === recordId
                ? { ...record, [columnName]: newValue }
                : record
        );

        // Track the change
        this.changeTracker.trackChange(recordId, columnName, newValue);

        // Notify parent component
        this.props.onCellChange(recordId, columnName, newValue);

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
            setTimeout(() => {
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
        const changedCount = this.changeTracker.getChangedRecordsCount();
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
                        />
                        <PrimaryButton
                            text={isSaving ? 'Saving...' : 'Save Changes'}
                            onClick={this.handleSave}
                            disabled={!hasChanges || isSaving}
                            className="save-button"
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
                    <DetailsList
                        items={filteredData}
                        columns={columns}
                        layoutMode={DetailsListLayoutMode.fixedColumns}
                        selectionMode={SelectionMode.none}
                        isHeaderVisible={true}
                        onColumnResize={this.handleColumnResize}
                    />
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
