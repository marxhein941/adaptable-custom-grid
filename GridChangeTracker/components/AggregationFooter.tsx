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

    // Sync footer scroll with grid scroll
    React.useEffect(() => {
        const gridContent = document.querySelector('.grid-content');
        const handleScroll = () => {
            if (footerRef.current && gridContent) {
                footerRef.current.scrollLeft = gridContent.scrollLeft;
            }
        };

        if (gridContent) {
            gridContent.addEventListener('scroll', handleScroll);
            return () => gridContent.removeEventListener('scroll', handleScroll);
        }
    }, []);

    return (
        <div className="aggregation-footer" ref={footerRef}>
            <div className="aggregation-footer-inner">
                {columns.map(column => {
                    const aggregation = aggregations[column.name];
                    const gridColumn = gridColumns.find(gc => gc.key === column.name);
                    const columnWidth = gridColumn?.currentWidth || gridColumn?.minWidth || 150;

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
                                <>
                                    <span className="aggregation-label">{column.displayName}:</span>
                                    <span className="aggregation-value">{aggregation.formattedValue}</span>
                                </>
                            ) : (
                                <span className="aggregation-label">{column.displayName}: -</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
