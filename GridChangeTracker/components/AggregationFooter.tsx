import * as React from 'react';
import { IColumn } from '@fluentui/react/lib/DetailsList';
import { AggregationResult, AggregationMode, getAggregationModeName } from '../utils/aggregations';

export interface IAggregationFooterProps {
    aggregations: AggregationResult;
    columns: ComponentFramework.PropertyHelper.DataSetApi.Column[];
    mode: AggregationMode;
    gridColumns: IColumn[];
}

export const AggregationFooter: React.FC<IAggregationFooterProps> = (props) => {
    const { aggregations, columns, mode, gridColumns } = props;
    const footerRef = React.useRef<HTMLDivElement>(null);

    // Don't render if mode is None
    if (mode === AggregationMode.None) {
        return null;
    }

    // Sync footer scroll with grid body scroll
    React.useEffect(() => {
        const gridBody = document.querySelector('.grid-body');

        const handleScroll = () => {
            if (footerRef.current && gridBody) {
                footerRef.current.scrollLeft = gridBody.scrollLeft;
            }
        };

        if (gridBody) {
            gridBody.addEventListener('scroll', handleScroll);
            return () => gridBody.removeEventListener('scroll', handleScroll);
        }
    }, []);

    // Observe column width changes from the custom header cells
    React.useEffect(() => {
        const updateColumnWidths = () => {
            const headerCells = document.querySelectorAll('.custom-header-cell');
            const footerCells = footerRef.current?.querySelectorAll('.aggregation-cell');

            if (headerCells.length > 0 && footerCells && footerCells.length > 0) {
                headerCells.forEach((headerCell, index) => {
                    if (footerCells[index]) {
                        const width = headerCell.getBoundingClientRect().width;
                        (footerCells[index] as HTMLElement).style.width = `${width}px`;
                        (footerCells[index] as HTMLElement).style.minWidth = `${width}px`;
                        (footerCells[index] as HTMLElement).style.maxWidth = `${width}px`;
                    }
                });
            }
        };

        // Initial update
        setTimeout(updateColumnWidths, 100);

        // Create ResizeObserver to watch for column resizes
        const resizeObserver = new ResizeObserver(() => {
            updateColumnWidths();
        });

        // Observe all custom header cells
        const headerCells = document.querySelectorAll('.custom-header-cell');
        headerCells.forEach(cell => resizeObserver.observe(cell));

        // Cleanup
        return () => {
            resizeObserver.disconnect();
        };
    }, [columns, gridColumns]);

    return (
        <div className="aggregation-footer" ref={footerRef}>
            <div className="aggregation-footer-row">
                {columns.map(column => {
                    const aggregation = aggregations[column.name];
                    const gridColumn = gridColumns.find(gc => gc.key === column.name);
                    const columnWidth = gridColumn?.currentWidth ?? gridColumn?.minWidth ?? 150;

                    return (
                        <div
                            key={column.name}
                            className="aggregation-cell"
                            style={{
                                width: `${columnWidth}px`,
                                minWidth: `${columnWidth}px`,
                                maxWidth: `${columnWidth}px`
                            }}
                        >
                            {aggregation ? (
                                <span className="aggregation-value">{aggregation.formattedValue}</span>
                            ) : (
                                <span className="aggregation-empty">-</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
