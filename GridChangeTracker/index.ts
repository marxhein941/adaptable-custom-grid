import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { GridComponent, IGridProps } from "./components/GridComponent";
import * as React from "react";

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
        this.notifyOutputChanged = notifyOutputChanged;
        this.context = context;

        // Log initialization
        console.log('GridChangeTracker initialized', {
            dataset: context.parameters.gridDataset,
            enableChangeTracking: context.parameters.enableChangeTracking?.raw,
            aggregationMode: context.parameters.aggregationMode?.raw
        });
    }

    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     * @returns ReactElement root react element for the control
     */
    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        this.context = context;

        // Get dataset
        const dataset = context.parameters.gridDataset;

        // Build props for React component
        const props: IGridProps = {
            dataset: dataset,
            enableChangeTracking: context.parameters.enableChangeTracking?.raw ?? true,
            changedCellColor: context.parameters.changedCellColor?.raw || "#FFF4CE",
            aggregationMode: Number(context.parameters.aggregationMode?.raw || 0),
            showChangeIndicator: context.parameters.showChangeIndicator?.raw ?? true,
            readOnlyFields: context.parameters.readOnlyFields?.raw || "",
            onCellChange: this.handleCellChange.bind(this),
            onSave: this.handleSave.bind(this)
        };

        // Log update
        console.log('GridChangeTracker updateView', {
            recordCount: dataset.sortedRecordIds?.length || 0,
            columns: dataset.columns?.length || 0,
            hasChanges: this.changedRecords.size > 0
        });

        // Render React component
        return React.createElement(GridComponent, props);
    }

    /**
     * Handle cell change event from the grid
     */
    private handleCellChange(recordId: string, columnName: string, newValue: any): void {
        try {
            // Track the change
            if (!this.changedRecords.has(recordId)) {
                this.changedRecords.set(recordId, {});
            }

            const recordChanges = this.changedRecords.get(recordId);
            if (recordChanges) {
                recordChanges[columnName] = newValue;
            }

            console.log('Cell changed', { recordId, columnName, newValue });

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
