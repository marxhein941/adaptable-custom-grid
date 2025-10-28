import { convertValueByDataType, isNumericType, isFieldEditableByType } from '../typeConverter';

describe('typeConverter', () => {
    describe('isNumericType', () => {
        it('should return true for numeric types', () => {
            expect(isNumericType('Whole.None')).toBe(true);
            expect(isNumericType('Decimal')).toBe(true);
            expect(isNumericType('FP')).toBe(true);
            expect(isNumericType('Currency')).toBe(true);
        });

        it('should return false for non-numeric types', () => {
            expect(isNumericType('SingleLine.Text')).toBe(false);
            expect(isNumericType('Lookup.Simple')).toBe(false);
            expect(isNumericType('DateAndTime.DateOnly')).toBe(false);
            expect(isNumericType('OptionSet')).toBe(false);
            expect(isNumericType('')).toBe(false);
        });
    });

    describe('isFieldEditableByType', () => {
        it('should return false for lookup fields', () => {
            expect(isFieldEditableByType('Lookup')).toBe(false);
        });

        it('should return false for GUID fields', () => {
            expect(isFieldEditableByType('Guid')).toBe(false);
        });

        it('should return true for editable types', () => {
            expect(isFieldEditableByType('SingleLine.Text')).toBe(true);
            expect(isFieldEditableByType('Whole.None')).toBe(true);
            expect(isFieldEditableByType('Decimal')).toBe(true);
            expect(isFieldEditableByType('DateAndTime.DateOnly')).toBe(true);
        });

        it('should return true for empty or unknown types', () => {
            expect(isFieldEditableByType(undefined)).toBe(true);
            expect(isFieldEditableByType('UnknownType')).toBe(true);
        });
    });

    describe('convertValueByDataType', () => {
        it('should convert string values to numbers for numeric types', () => {
            expect(convertValueByDataType('123', 'Whole.None')).toBe(123);
            expect(convertValueByDataType('45.67', 'Decimal')).toBe(45.67);
            expect(convertValueByDataType('100.5', 'Currency')).toBe(100.5);
        });

        it('should return null for invalid numeric values', () => {
            expect(convertValueByDataType('abc', 'Whole.None')).toBeNull();
            expect(convertValueByDataType('', 'Decimal')).toBeNull();
            expect(convertValueByDataType('', 'Currency')).toBeNull();
        });

        it('should preserve string values for text types', () => {
            expect(convertValueByDataType('test', 'SingleLine.Text')).toBe('test');
            expect(convertValueByDataType('email@test.com', 'SingleLine.Email')).toBe('email@test.com');
        });

        it('should handle optionset numeric values', () => {
            expect(convertValueByDataType(123, 'OptionSet')).toBe(123);
            expect(convertValueByDataType('456', 'OptionSet')).toBe(456);
        });

        it('should handle empty strings', () => {
            expect(convertValueByDataType('', 'SingleLine.Text')).toBeNull();
            expect(convertValueByDataType('', 'Whole.None')).toBeNull();
        });

        it('should handle null and undefined values', () => {
            expect(convertValueByDataType(null, 'SingleLine.Text')).toBeNull();
            expect(convertValueByDataType(undefined, 'SingleLine.Text')).toBeNull();
        });
    });
});
