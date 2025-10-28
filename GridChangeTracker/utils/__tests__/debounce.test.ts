import { debounce } from '../debounce';

describe('debounce', () => {
    jest.useFakeTimers();

    afterEach(() => {
        jest.clearAllTimers();
    });

    it('should debounce function calls', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 300);

        debouncedFn('test1');
        debouncedFn('test2');
        debouncedFn('test3');

        expect(mockFn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(300);

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('test3');
    });

    it('should call function with latest arguments after delay', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 200);

        debouncedFn(1);
        jest.advanceTimersByTime(100);
        debouncedFn(2);
        jest.advanceTimersByTime(100);
        debouncedFn(3);
        jest.advanceTimersByTime(200);

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith(3);
    });

    it('should handle multiple invocations after delay', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn('first');
        jest.advanceTimersByTime(100);

        debouncedFn('second');
        jest.advanceTimersByTime(100);

        expect(mockFn).toHaveBeenCalledTimes(2);
        expect(mockFn).toHaveBeenNthCalledWith(1, 'first');
        expect(mockFn).toHaveBeenNthCalledWith(2, 'second');
    });
});
