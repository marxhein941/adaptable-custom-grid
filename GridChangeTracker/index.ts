import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { GridComponent, IGridProps } from "./components/GridComponent";
import { ErrorBoundary } from "./components/ErrorBoundary";
import * as React from "react";
import { convertValueByDataType, getColumnMetadata } from "./utils/typeConverter";

export class GridChangeTracker implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private notifyOutputChanged: () => void;
    private context: ComponentFramework.Context<IInputs>;
    private changedRecords: Map<string, any>;

    /**
     * Constructor
     */
    constructor() {
        this.changedRecords = new Map();
    }

    /**
     * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
     * Data-set values are not initialized here, use updateView.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
     * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
     * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
     */
    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary
    ): void {
        try {
            console.log('[GridChangeTracker] Starting initialization...');

            this.notifyOutputChanged = notifyOutputChanged;
            this.context = context;

            // Comprehensive initialization logging
            console.log('[GridChangeTracker] Init context:', {
                parameters: {
                    gridDataset: {
                        isLoading: context.parameters.gridDataset?.loading,
                        hasError: context.parameters.gridDataset?.error,
                        errorMessage: context.parameters.gridDataset?.errorMessage,
                        recordCount: context.parameters.gridDataset?.sortedRecordIds?.length || 0,
                        columns: context.parameters.gridDataset?.columns ? Object.keys(context.parameters.gridDataset.columns).length : 0
                    },
                    enableChangeTracking: context.parameters.enableChangeTracking?.raw,
                    aggregationMode: context.parameters.aggregationMode?.raw,
                    changedCellColor: context.parameters.changedCellColor?.raw,
                    showChangeIndicator: context.parameters.showChangeIndicator?.raw,
                    readOnlyFields: context.parameters.readOnlyFields?.raw,
                    useDescriptionAsColumnName: context.parameters.useDescriptionAsColumnName?.raw
                },
                mode: context.mode,
                userSettings: context.userSettings,
                client: context.client
            });

            // Check for dataset errors
            if (context.parameters.gridDataset?.error) {
                console.error('[GridChangeTracker] Dataset error detected:', context.parameters.gridDataset.errorMessage);
            }

            console.log('[GridChangeTracker] Initialization completed successfully');
        } catch (error) {
            console.error('[GridChangeTracker] CRITICAL: Initialization failed!', error);
            console.error('[GridChangeTracker] Error details:', {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : 'No stack trace available',
                context: {
                    hasContext: !!context,
                    hasParameters: !!context?.parameters,
                    hasDataset: !!context?.parameters?.gridDataset
                }
            });
            throw error; // Re-throw to ensure Power Apps knows initialization failed
        }
    }

    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     * @returns ReactElement root react element for the control
     */
    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        try {
            console.log('[GridChangeTracker] UpdateView called');

            this.context = context;

            // Get dataset
            const dataset = context.parameters.gridDataset;

            // Comprehensive dataset validation
            if (!dataset) {
                console.error('[GridChangeTracker] CRITICAL: Dataset is null or undefined!');
                return React.createElement(
                    'div',
                    { style: { padding: '20px', color: 'red' } },
                    'Error: Dataset not available. Please check control configuration.'
                );
            }

            // Check for dataset errors
            if (dataset.error) {
                console.error('[GridChangeTracker] Dataset has error:', dataset.errorMessage);
                return React.createElement(
                    'div',
                    { style: { padding: '20px', color: 'red' } },
                    `Dataset Error: ${dataset.errorMessage || 'Unknown error occurred'}`
                );
            }

            // Build props for React component
            const props: IGridProps = {
                dataset: dataset,
                enableChangeTracking: context.parameters.enableChangeTracking?.raw ?? true,
                changedCellColor: context.parameters.changedCellColor?.raw || "#FFF4CE",
                aggregationMode: Number(context.parameters.aggregationMode?.raw || 0),
                showChangeIndicator: context.parameters.showChangeIndicator?.raw ?? true,
                readOnlyFields: context.parameters.readOnlyFields?.raw || "",
                useDescriptionAsColumnName: context.parameters.useDescriptionAsColumnName?.raw ?? false,
                onCellChange: this.handleCellChange.bind(this),
                onSave: this.handleSave.bind(this),
                // Pass the full context so GridComponent can access WebAPI
                context: context
            };

            // Detailed update logging
            console.log('[GridChangeTracker] UpdateView context:', {
                datasetStatus: {
                    loading: dataset.loading,
                    error: dataset.error,
                    errorMessage: dataset.errorMessage,
                    recordCount: dataset.sortedRecordIds?.length || 0,
                    columns: dataset.columns ? Object.keys(dataset.columns) : [],
                    paging: {
                        pageSize: dataset.paging?.pageSize,
                        totalResultCount: dataset.paging?.totalResultCount,
                        hasNextPage: dataset.paging?.hasNextPage,
                        hasPreviousPage: dataset.paging?.hasPreviousPage
                    }
                },
                props: {
                    enableChangeTracking: props.enableChangeTracking,
                    aggregationMode: props.aggregationMode,
                    showChangeIndicator: props.showChangeIndicator,
                    changedCellColor: props.changedCellColor
                },
                changedRecordsCount: this.changedRecords.size
            });

            // Render React component wrapped in ErrorBoundary
            return React.createElement(
                ErrorBoundary,
                null,
                React.createElement(GridComponent, props)
            );
        } catch (error) {
            console.error('[GridChangeTracker] CRITICAL: UpdateView failed!', error);
            console.error('[GridChangeTracker] UpdateView error details:', {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : 'No stack trace available'
            });

            // Return error display
            return React.createElement(
                'div',
                { style: { padding: '20px', color: 'red', fontFamily: 'monospace' } },
                [
                    React.createElement('h3', { key: 'title' }, 'GridChangeTracker Error'),
                    React.createElement('pre', { key: 'error' }, error instanceof Error ? error.message : String(error)),
                    React.createElement('p', { key: 'instruction' }, 'Check browser console for detailed error information.')
                ]
            );
        }
    }

    /**
     * Handle cell change event from the grid
     */
    private handleCellChange(recordId: string, columnName: string, newValue: any): void {
        try {
            // Get column metadata to ensure proper data type conversion
            const dataset = this.context.parameters.gridDataset;
            const columnMetadata = getColumnMetadata(dataset, columnName);
            const dataType = columnMetadata?.dataType;

            // Convert the value based on the column's actual data type
            const processedValue = convertValueByDataType(newValue, dataType, columnName);

            console.log(`[Index] Processing cell change for ${columnName}:`, {
                originalValue: newValue,
                originalType: typeof newValue,
                processedValue,
                processedType: typeof processedValue,
                columnDataType: dataType
            });

            // Track the change
            if (!this.changedRecords.has(recordId)) {
                this.changedRecords.set(recordId, {});
            }

            const recordChanges = this.changedRecords.get(recordId);
            if (recordChanges) {
                recordChanges[columnName] = processedValue;
            }

            // Notify framework
            this.notifyOutputChanged();
        } catch (error) {
            console.error('Error handling cell change:', error);
        }
    }

    /**
     * Handle save event from the grid
     */
    private async handleSave(): Promise<void> {
        try {
            console.log('Starting save operation', {
                changedRecordsCount: this.changedRecords.size
            });

            if (this.changedRecords.size === 0) {
                console.log('No changes to save');
                return;
            }

            const dataset = this.context.parameters.gridDataset;
            const entityName = dataset.getTargetEntityType();
            const promises: Promise<ComponentFramework.LookupValue>[] = [];

            // Build update promises
            this.changedRecords.forEach((changes, recordId) => {
                console.log('Preparing update for record', { recordId, changes });

                promises.push(
                    this.context.webAPI.updateRecord(entityName, recordId, changes)
                );
            });

            // Execute all updates
            await Promise.all(promises);

            console.log('Save operation completed successfully');

            // Clear changed records
            this.changedRecords.clear();

            // Refresh dataset
            dataset.refresh();

            // Notify framework
            this.notifyOutputChanged();
        } catch (error) {
            console.error('Error saving changes:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to save changes: ${errorMessage}`);
        }
    }

    /**
     * It is called by the framework prior to a control receiving new data.
     * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
     */
    public getOutputs(): IOutputs {
        return {};
    }

    /**
     * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
     * i.e. cancelling any pending remote calls, removing listeners, etc.
     */
    public destroy(): void {
        // Clear any pending changes
        this.changedRecords.clear();

        console.log('GridChangeTracker destroyed');
    }
}
