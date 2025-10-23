
📋 Vertical Drag-and-Fill Implementation Guide for PCF Custom Grid

  Executive Summary

  This guide details how to implement vertical drag-and-fill functionality in your PowerApps PCF custom grid component. The implementation will allow users to:
  - Select a cell and drag vertically from a fill handle to copy its value to cells above or below
  - Fill cells only within the same column (vertical-only operation)
  - Maintain full integration with existing change tracking and validation systems
  - Respect all current editability rules and constraints

  ---
  1. Architecture Overview

  1.1 High-Level Implementation Strategy

  The vertical drag-and-fill feature will be implemented as an extension to the existing GridComponent.tsx with:
  - New state management for cell selection and vertical drag operations
  - Mouse event handlers for vertical drag detection and execution
  - Simple value copying logic (no pattern detection)
  - Visual feedback components for user interaction
  - Integration points with existing change tracking

  1.2 Component Interaction Flow

  User Interaction Flow:
  1. User clicks cell → Set as selected
  2. Fill handle appears → Small square in bottom-right
  3. User drags handle vertically → Preview overlay shows
  4. User releases → Cell value is copied to target cells
  5. Changes tracked → Via existing changeTracker
  6. Grid updates → Visual indicators update

  ---
  2. Detailed Implementation Plan

  Phase 1: Cell Selection Infrastructure

  2.1 Update State Interface (GridComponent.tsx:~line 50)

  interface IGridState {
      // ... existing state ...

      // New selection-related state
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
          endRow: number;
          columnKey: string;  // Single column for vertical-only operation
      } | null;
      fillDirection: 'down' | 'up' | null;  // Only vertical directions
      fillHandlePosition: { x: number; y: number } | null;
  }

  2.2 Cell Selection Methods

  Add these methods to GridComponent:

  // Single cell selection
  private selectCell = (recordId: string, columnName: string): void => {
      const cellKey = `${recordId}_${columnName}`;

      // Check if cell is editable before allowing selection
      const record = this.state.currentData.find(r => r.id === recordId);
      const column = this.state.columns.find(c => c.key === columnName);

      if (!this.isFieldEditable(record, column)) {
          return; // Cannot select read-only cells
      }

      this.setState({
          selectedCells: new Set([cellKey]),
          anchorCell: cellKey,
          selectionRange: null
      });
  }

  // Range selection (Shift+Click)
  private selectRange = (fromCell: string, toCell: string): void => {
      const [fromRecordId, fromColumn] = fromCell.split('_');
      const [toRecordId, toColumn] = toCell.split('_');

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

              if (this.isFieldEditable(record, column)) {
                  selectedCells.add(`${record.id}_${column.key}`);
              }
          }
      }

      this.setState({
          selectedCells,
          selectionRange: range
      });
  }

  ---
  Phase 2: Fill Handle Component

  2.3 Create Fill Handle Component (components/FillHandle.tsx)

  import * as React from 'react';

  interface IFillHandleProps {
      visible: boolean;
      position: { x: number; y: number };
      onDragStart: (e: React.MouseEvent) => void;
  }

  export const FillHandle: React.FC<IFillHandleProps> = ({ visible, position, onDragStart }) => {
      if (!visible || !position) return null;

      return (
          <div
              className="fill-handle"
              style={{
                  position: 'absolute',
                  left: position.x - 3,
                  top: position.y - 3,
                  width: '7px',
                  height: '7px',
                  backgroundColor: '#0078d4',
                  border: '1px solid white',
                  cursor: 'crosshair',
                  zIndex: 1000
              }}
              onMouseDown={onDragStart}
          />
      );
  };

  2.4 Update Cell Rendering (GridComponent.tsx:renderCell())

  Modify the cell rendering to include selection indicators:

  private renderCell = (record: any, column: IColumn, index: number): JSX.Element => {
      const cellKey = `${record.id}_${column.key}`;
      const isSelected = this.state.selectedCells.has(cellKey);
      const isAnchor = this.state.anchorCell === cellKey;
      const isInFillPreview = this.isCellInFillPreview(cellKey);

      // ... existing editability checks ...

      const cellClassName = classNames(
          'custom-data-cell',
          {
              'editable-cell': finalIsEditable,
              'readonly-cell': !finalIsEditable,
              'changed-cell': isChanged,
              'selected-cell': isSelected,        // New
              'anchor-cell': isAnchor,            // New
              'fill-preview-cell': isInFillPreview // New
          }
      );

      return (
          <div
              key={`${record.id}_${column.key}`}
              className={cellClassName}
              style={{
                  ...cellStyle,
                  backgroundColor: isChanged ? this.props.changedCellColor : undefined,
                  border: isSelected ? '2px solid #0078d4' : undefined,
                  boxShadow: isAnchor ? 'inset 0 0 0 1px #0078d4' : undefined
              }}
              onMouseDown={(e) => this.handleCellMouseDown(e, record.id, column.key)}
              onMouseEnter={(e) => this.handleCellMouseEnter(e, record.id, column.key)}
          >
              {/* existing cell content */}
              {finalIsEditable ? (
                  <TextField ... />
              ) : (
                  <span ... />
              )}

              {/* Add fill handle for anchor cell */}
              {isAnchor && (
                  <FillHandle
                      visible={true}
                      position={this.getFillHandlePosition(cellKey)}
                      onDragStart={this.handleFillDragStart}
                  />
              )}
          </div>
      );
  };

  ---
  Phase 3: Vertical Drag-Fill Operations

  2.5 Simple Fill Value Logic

  Since we only copy values without pattern detection, the logic is simplified:

  /**
   * Simple vertical fill helper - copies a single value to target cells
   */
  export class VerticalFillHelper {
      /**
       * Gets the value to fill (simply returns the source value)
       */
      static getFillValue(sourceValue: any): any {
          return sourceValue;
      }

      /**
       * Generates fill values for vertical drag
       * Simply repeats the source value for the count needed
       */
      static generateFillValues(sourceValue: any, count: number): any[] {
          return new Array(count).fill(sourceValue);
      }
  }

  2.6 Drag-Fill Mouse Handlers (GridComponent.tsx)

  private handleFillDragStart = (e: React.MouseEvent): void => {
      e.preventDefault();
      e.stopPropagation();

      this.setState({ isDraggingFill: true });

      // Add document-level mouse listeners
      document.addEventListener('mousemove', this.handleFillDragMove);
      document.addEventListener('mouseup', this.handleFillDragEnd);
      document.body.style.cursor = 'crosshair';
  }

  private handleFillDragMove = (e: MouseEvent): void => {
      if (!this.state.isDraggingFill || !this.state.anchorCell) return;

      // Get the cell under the mouse
      const targetElement = document.elementFromPoint(e.clientX, e.clientY);
      const cellElement = targetElement?.closest('.custom-data-cell');

      if (cellElement) {
          // Extract cell coordinates from element
          const cellId = cellElement.getAttribute('data-cell-id'); // Need to add this attribute
          if (cellId) {
              const [recordId, columnKey] = cellId.split('_');

              // Calculate fill preview range
              this.updateFillPreview(this.state.anchorCell, `${recordId}_${columnKey}`);
          }
      }
  }

  private handleFillDragEnd = (e: MouseEvent): void => {
      if (!this.state.isDraggingFill) return;

      // Remove document listeners
      document.removeEventListener('mousemove', this.handleFillDragMove);
      document.removeEventListener('mouseup', this.handleFillDragEnd);
      document.body.style.cursor = '';

      // Execute fill operation if we have a preview range
      if (this.state.fillPreviewRange) {
          this.executeFillOperation();
      }

      this.setState({
          isDraggingFill: false,
          fillPreviewRange: null,
          fillDirection: null
      });
  }

  private updateFillPreview = (fromCell: string, toCell: string): void => {
      // Calculate the fill preview range for vertical-only operation
      const [fromRecordId, fromColumn] = fromCell.split('_');
      const [toRecordId, toColumn] = toCell.split('_');

      // Only allow vertical drag in the same column
      if (fromColumn !== toColumn) {
          // Clear preview if user tries to drag horizontally
          this.setState({
              fillPreviewRange: null,
              fillDirection: null
          });
          return;
      }

      const fromRow = this.state.currentData.findIndex(r => r.id === fromRecordId);
      const toRow = this.state.currentData.findIndex(r => r.id === toRecordId);

      // Determine vertical fill direction
      const direction: 'down' | 'up' = fromRow < toRow ? 'down' : 'up';

      // Create preview range for vertical fill
      const previewRange = {
          startRow: Math.min(fromRow, toRow),
          endRow: Math.max(fromRow, toRow),
          columnKey: fromColumn
      };

      this.setState({
          fillPreviewRange: previewRange,
          fillDirection: direction
      });
  }

  ---
  Phase 4: Fill Operation Execution

  2.7 Execute Fill Operation (GridComponent.tsx)

  private executeFillOperation = async (): Promise<void> => {
      if (!this.state.fillPreviewRange || !this.state.anchorCell) return;

      const { fillPreviewRange, currentData, columns } = this.state;

      // Get source value from the anchor cell
      const [sourceRecordId, sourceColumnKey] = this.state.anchorCell.split('_');
      const sourceRecord = currentData.find(r => r.id === sourceRecordId);
      const sourceColumn = columns.find(c => c.key === sourceColumnKey);

      if (!sourceRecord || !sourceColumn) return;

      const sourceValue = sourceRecord[sourceColumnKey];
      const dataType = sourceColumn.data?.dataType || 'SingleLine.Text';

      // Calculate cells to fill vertically (excluding source cell and read-only cells)
      const cellsToFill: Array<{ record: any; column: IColumn }> = [];
      const column = columns.find(c => c.key === fillPreviewRange.columnKey);

      if (!column) return;

      for (let row = fillPreviewRange.startRow; row <= fillPreviewRange.endRow; row++) {
          const record = currentData[row];
          const cellKey = `${record.id}_${column.key}`;

          // Skip if:
          // 1. Cell is the source cell
          // 2. Cell is not editable
          if (cellKey === this.state.anchorCell || !this.isFieldEditable(record, column)) {
              continue;
          }

          cellsToFill.push({ record, column });
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
          const convertedValue = this.convertValueByDataType(newValue, column.data?.dataType);

          // Find record in updatedData and update
          const recordIndex = updatedData.findIndex(r => r.id === record.id);
          if (recordIndex !== -1) {
              updatedData[recordIndex] = {
                  ...updatedData[recordIndex],
                  [column.key]: convertedValue
              };

              // Track the change
              this.changeTracker.trackChange(record.id, column.key, convertedValue);
              changesMade = true;
          }
      }

      // Update state if changes were made
      if (changesMade) {
          this.setState(
              { currentData: updatedData },
              () => {
                  // Notify parent component
                  this.debouncedNotifyChange();

                  // Recalculate aggregations
                  if (this.props.aggregationMode && this.props.aggregationMode !== AggregationMode.None) {
                      this.calculateAggregations();
                  }

                  // Show success message
                  this.setState({
                      successMessage: `Filled ${cellsToFill.length} cells successfully`
                  });

                  setTimeout(() => {
                      this.setState({ successMessage: null });
                  }, 3000);
              }
          );
      }

      // Clear selection
      this.setState({
          selectedCells: new Set(),
          anchorCell: null,
          selectionRange: null
      });
  }

  ---
  Phase 5: Visual Feedback and CSS

  2.8 Update CSS (css/GridChangeTracker.css)

  Add these styles for selection and drag-fill:

  /* Cell selection styles */
  .selected-cell {
      position: relative;
      outline: 2px solid #0078d4 !important;
      outline-offset: -1px;
      background-color: rgba(0, 120, 212, 0.05);
  }

  .anchor-cell {
      position: relative;
      box-shadow: inset 0 0 0 2px #0078d4 !important;
  }

  /* Fill handle */
  .fill-handle {
      position: absolute;
      width: 7px;
      height: 7px;
      background-color: #0078d4;
      border: 1px solid white;
      cursor: crosshair;
      z-index: 1000;
      bottom: -4px;
      right: -4px;
  }

  .fill-handle:hover {
      background-color: #106ebe;
      transform: scale(1.2);
  }

  /* Fill preview */
  .fill-preview-cell {
      background-color: rgba(0, 120, 212, 0.1) !important;
      border: 1px dashed #0078d4 !important;
  }

  /* Drag cursor */
  .grid-container.dragging-fill {
      cursor: crosshair !important;
  }

  .grid-container.dragging-fill * {
      cursor: crosshair !important;
  }

  /* Selection range animation */
  @keyframes selection-pulse {
      0% { border-color: #0078d4; }
      50% { border-color: #106ebe; }
      100% { border-color: #0078d4; }
  }

  .selection-range {
      animation: selection-pulse 1s infinite;
  }

  /* Fill direction indicators - vertical only */
  .fill-direction-indicator {
      position: absolute;
      pointer-events: none;
      z-index: 999;
  }

  .fill-direction-indicator.down::after {
      content: '↓';
      position: absolute;
      bottom: -20px;
      right: 50%;
      transform: translateX(50%);
      font-size: 20px;
      color: #0078d4;
  }

  .fill-direction-indicator.up::after {
      content: '↑';
      position: absolute;
      top: -20px;
      right: 50%;
      transform: translateX(50%);
      font-size: 20px;
      color: #0078d4;
  }

  ---
  Phase 6: Keyboard Support Integration

  2.9 Connect Existing Keyboard Shortcuts

  Update the keyboard shortcut handlers in utils/keyboardShortcuts.ts:

  // Update the existing handlers
  const enhancedHandlers: KeyboardActionHandlers = {
      ...existingHandlers,

      fillDown: () => {
          // Ctrl+D - Fill down from selected cell
          if (this.state.anchorCell) {
              this.executeFillInDirection('down');
          }
      },

      fillUp: () => {
          // Ctrl+U - Fill up from selected cell (optional)
          if (this.state.anchorCell) {
              this.executeFillInDirection('up');
          }
      },

      selectAll: () => {
          // Ctrl+A - Select all editable cells
          const allEditableCells = new Set<string>();
          this.state.currentData.forEach(record => {
              this.state.columns.forEach(column => {
                  if (this.isFieldEditable(record, column)) {
                      allEditableCells.add(`${record.id}_${column.key}`);
                  }
              });
          });
          this.setState({ selectedCells: allEditableCells });
      },

      clearSelection: () => {
          // Escape - Clear current selection
          this.setState({
              selectedCells: new Set(),
              anchorCell: null,
              selectionRange: null
          });
      }
  };

  ---
  3. Implementation Checklist

  Phase 1: Foundation (1 day)

  - Add selection state to IGridState
  - Implement single cell selection
  - Add visual selection indicators
  - Test selection with editable/read-only cells

  Phase 2: Fill Handle (1 day)

  - Create FillHandle component
  - Position fill handle on anchor cell
  - Implement drag start detection
  - Add cursor changes during drag
  - Test handle visibility and positioning

  Phase 3: Vertical Drag Operations (1-2 days)

  - Implement drag move handlers
  - Restrict to vertical movement only
  - Calculate fill preview range for column
  - Show preview overlay
  - Handle scroll during drag

  Phase 4: Simple Fill Logic (1 day)

  - Create VerticalFillHelper utility
  - Implement value copying
  - Execute fill operation
  - Integrate with changeTracker
  - Test with different data types

  Phase 5: Polish (1 day)

  - Add CSS animations
  - Implement keyboard shortcuts (Ctrl+D)
  - Performance optimization
  - Edge case handling

  Phase 6: Testing (1 day)

  - Integration tests with change tracking
  - Performance tests with large datasets
  - User acceptance testing
  - Documentation

  ---
  4. Key Considerations and Gotchas

  4.1 Performance Optimization

  - Batch Updates: When filling many cells, batch all changes and render once
  - Debouncing: Use existing debounced notification system
  - Virtual Scrolling: Consider impact on large datasets (5000 rows)
  - Memory Management: Clear selection sets when not needed

  4.2 Data Type Handling

  - Type Conversion: Use existing convertValueByDataType() method
  - Validation: Respect data type constraints during fill
  - Format Preservation: Maintain number/date formats
  - Null Handling: Consider how to handle empty source cells

  4.3 Edge Cases

  - Boundary Conditions: Filling at top/bottom of grid
  - Column Restriction: Prevent horizontal drag attempts
  - Read-Only Cells: Skip during fill operation
  - Disabled Rows: Respect row-level editability
  - Scroll Position: Maintain during vertical fill operations

  4.4 Integration Points

  - Change Tracking: Every filled cell must go through changeTracker.trackChange()
  - Aggregations: Recalculate after fill operations
  - WebAPI Save: Filled values saved with existing save mechanism
  - Notifications: Use existing success/error message system

  ---
  5. Testing Strategy

  5.1 Unit Tests

  describe('VerticalFillHelper', () => {
      it('should copy single value to multiple cells', () => {
          const sourceValue = 'Test Value';
          const result = VerticalFillHelper.generateFillValues(sourceValue, 5);
          expect(result.length).toBe(5);
          expect(result.every(v => v === sourceValue)).toBe(true);
      });

      it('should handle numeric values', () => {
          const sourceValue = 42;
          const result = VerticalFillHelper.generateFillValues(sourceValue, 3);
          expect(result).toEqual([42, 42, 42]);
      });
  });

  5.2 Integration Tests

  - Test fill with change tracking
  - Test fill with read-only fields
  - Test fill with row-level permissions
  - Test fill with aggregations enabled

  5.3 Performance Tests

  - Fill 100+ cells vertically
  - Fill during active sorting
  - Memory usage monitoring
  - Test with large column values

  ---
  6. Future Enhancements

  Potential Future Features

  1. Pattern Detection: Optional increment/decrement for numbers
  2. Date Series: Support for date incrementing
  3. Fill Options Dialog: Choose between copy/increment
  4. Multi-Select Fill: Fill from multiple selected cells
  5. Fill History: Undo/redo specific to fill operations
  6. Conditional Fill: Fill based on conditions

  ---
  7. Summary

  This implementation guide provides a complete roadmap for adding vertical drag-and-fill functionality to your PCF custom grid. The implementation:

  ✅ Simple value copying - Copies the source cell value to target cells vertically
  ✅ Vertical-only operation - Restricts drag to up/down within the same column
  ✅ Leverages existing architecture - Works with current change tracking and validation
  ✅ Respects all constraints - Honors read-only fields and row-level permissions
  ✅ Maintains performance - Uses batching and debouncing
  ✅ Provides clean UX - Visual feedback, keyboard shortcuts, intuitive drag behavior

  Estimated Development Time: 5-7 days for complete implementation including testing

  The simplified approach focuses on the most common use case - copying values vertically within a column - making it faster to implement and easier to maintain.

