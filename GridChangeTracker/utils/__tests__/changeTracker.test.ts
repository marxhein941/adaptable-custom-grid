import { ChangeTracker } from '../changeTracker';

describe('ChangeTracker', () => {
    let tracker: ChangeTracker;

    beforeEach(() => {
        tracker = new ChangeTracker();
    });

    describe('initializeData', () => {
        it('should initialize with data', () => {
            const data = [
                { id: '1', name: 'Test 1', value: 100 },
                { id: '2', name: 'Test 2', value: 200 }
            ];

            tracker.initializeData(data);
            expect(tracker.getChangedRecordsCount()).toBe(0);
        });
    });

    describe('trackChange', () => {
        beforeEach(() => {
            const data = [
                { id: '1', name: 'Test 1', value: 100 },
                { id: '2', name: 'Test 2', value: 200 }
            ];
            tracker.initializeData(data);
        });

        it('should track new changes', () => {
            const isChanged = tracker.trackChange('1', 'name', 'Updated Name');

            expect(isChanged).toBe(true);
            expect(tracker.isCellChanged('1', 'name')).toBe(true);
        });

        it('should not track when value equals original', () => {
            const isChanged = tracker.trackChange('1', 'name', 'Test 1');

            expect(isChanged).toBe(false);
            expect(tracker.isCellChanged('1', 'name')).toBe(false);
        });

        it('should track multiple changes for same record', () => {
            tracker.trackChange('1', 'name', 'Updated Name');
            tracker.trackChange('1', 'value', 150);

            expect(tracker.isCellChanged('1', 'name')).toBe(true);
            expect(tracker.isCellChanged('1', 'value')).toBe(true);
        });

        it('should track changes across multiple records', () => {
            tracker.trackChange('1', 'name', 'Updated 1');
            tracker.trackChange('2', 'name', 'Updated 2');

            expect(tracker.isCellChanged('1', 'name')).toBe(true);
            expect(tracker.isCellChanged('2', 'name')).toBe(true);
        });
    });

    describe('getChanges', () => {
        beforeEach(() => {
            const data = [
                { id: '1', name: 'Test 1', value: 100 },
                { id: '2', name: 'Test 2', value: 200 }
            ];
            tracker.initializeData(data);
        });

        it('should return all tracked changes', () => {
            tracker.trackChange('1', 'name', 'Updated 1');
            tracker.trackChange('2', 'value', 250);

            const changes = tracker.getChanges();
            expect(Object.keys(changes)).toHaveLength(2);
            expect(changes['1'].name).toBe('Updated 1');
            expect(changes['2'].value).toBe(250);
        });

        it('should return empty object when no changes', () => {
            const changes = tracker.getChanges();
            expect(changes).toEqual({});
        });
    });

    describe('clearChanges', () => {
        it('should clear all tracked changes', () => {
            const data = [{ id: '1', name: 'Test', value: 100 }];
            tracker.initializeData(data);
            tracker.trackChange('1', 'name', 'Updated');

            expect(tracker.getChangedRecordsCount()).toBe(1);

            tracker.clearChanges();

            expect(tracker.getChangedRecordsCount()).toBe(0);
            expect(tracker.getChanges()).toEqual({});
        });
    });

    describe('getChangedRecordsCount', () => {
        beforeEach(() => {
            const data = [
                { id: '1', name: 'Test 1' },
                { id: '2', name: 'Test 2' },
                { id: '3', name: 'Test 3' }
            ];
            tracker.initializeData(data);
        });

        it('should return correct count of changed records', () => {
            tracker.trackChange('1', 'name', 'Updated 1');
            tracker.trackChange('1', 'value', 100);
            tracker.trackChange('2', 'name', 'Updated 2');

            expect(tracker.getChangedRecordsCount()).toBe(2);
        });

        it('should return zero when no changes', () => {
            expect(tracker.getChangedRecordsCount()).toBe(0);
        });
    });
});
