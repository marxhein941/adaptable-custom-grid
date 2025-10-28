import { calculateAggregations, AggregationMode, getAggregationMode, getAggregationModeName } from '../aggregations';

describe('aggregations', () => {
    const mockColumns = [
        { name: 'textCol', dataType: 'SingleLine.Text' },
        { name: 'numberCol', dataType: 'Whole.None' },
        { name: 'decimalCol', dataType: 'Decimal' }
    ] as ComponentFramework.PropertyHelper.DataSetApi.Column[];

    const mockData = [
        { textCol: 'A', numberCol: '10', numberCol_raw: 10, decimalCol: '5.5', decimalCol_raw: 5.5 },
        { textCol: 'B', numberCol: '20', numberCol_raw: 20, decimalCol: '10.0', decimalCol_raw: 10.0 },
        { textCol: 'C', numberCol: '30', numberCol_raw: 30, decimalCol: '15.5', decimalCol_raw: 15.5 }
    ];

    describe('getAggregationMode', () => {
        it('should return correct aggregation mode', () => {
            expect(getAggregationMode(0)).toBe(AggregationMode.None);
            expect(getAggregationMode(1)).toBe(AggregationMode.Sum);
            expect(getAggregationMode(2)).toBe(AggregationMode.Average);
            expect(getAggregationMode(3)).toBe(AggregationMode.Count);
            expect(getAggregationMode(999)).toBe(AggregationMode.None);
        });
    });

    describe('getAggregationModeName', () => {
        it('should return correct mode name', () => {
            expect(getAggregationModeName(AggregationMode.None)).toBe('None');
            expect(getAggregationModeName(AggregationMode.Sum)).toBe('Sum');
            expect(getAggregationModeName(AggregationMode.Average)).toBe('Average');
            expect(getAggregationModeName(AggregationMode.Count)).toBe('Count');
        });
    });

    describe('calculateAggregations', () => {
        it('should return empty object for None mode', () => {
            const result = calculateAggregations(mockData, mockColumns, AggregationMode.None);
            expect(result).toEqual({});
        });

        it('should calculate sum for numeric columns', () => {
            const result = calculateAggregations(mockData, mockColumns, AggregationMode.Sum);

            expect(result.numberCol).toBeDefined();
            expect(result.numberCol?.value).toBe(60);
            expect(result.numberCol?.formattedValue).toContain('60');

            expect(result.decimalCol).toBeDefined();
            expect(result.decimalCol?.value).toBe(31);
        });

        it('should calculate average for numeric columns', () => {
            const result = calculateAggregations(mockData, mockColumns, AggregationMode.Average);

            expect(result.numberCol).toBeDefined();
            expect(result.numberCol?.value).toBe(20);
            expect(result.numberCol?.formattedValue).toContain('20');
        });

        it('should calculate count for numeric columns', () => {
            const result = calculateAggregations(mockData, mockColumns, AggregationMode.Count);

            // Count only works for numeric columns in the implementation
            expect(result.numberCol).toBeDefined();
            expect(result.numberCol?.value).toBe(3);
            expect(result.numberCol?.formattedValue).toContain('3');
        });

        it('should handle empty data', () => {
            const result = calculateAggregations([], mockColumns, AggregationMode.Sum);
            expect(Object.keys(result).length).toBe(0);
        });

        it('should ignore text columns for sum/average', () => {
            const result = calculateAggregations(mockData, mockColumns, AggregationMode.Sum);
            expect(result.textCol).toBeUndefined();
        });
    });
});
