import * as React from 'react';
import { AggregationResult, AggregationMode, getAggregationModeName } from '../utils/aggregations';

export interface IAggregationFooterProps {
    aggregations: AggregationResult;
    columns: ComponentFramework.PropertyHelper.DataSetApi.Column[];
    mode: AggregationMode;
}

export const AggregationFooter: React.FC<IAggregationFooterProps> = (props) => {
    const { aggregations, columns, mode } = props;

    // Don't render if mode is None
    if (mode === AggregationMode.None) {
        return null;
    }

    return (
        <div className="aggregation-footer">
            {columns.map(column => {
                const aggregation = aggregations[column.name];

                return (
                    <div key={column.name} className="aggregation-cell">
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
    );
};
