import { throttle } from '../throttle';

describe('throttle', () => {
    jest.useFakeTimers();

    afterEach(() => {
        jest.clearAllTimers();
    });

    it('should call function immediately on first invocation', () => {
        const mockFn = jest.fn();
        const throttledFn = throttle(mockFn, 300);

        throttledFn('test');

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should throttle subsequent calls within the limit', () => {
        const mockFn = jest.fn();
        const throttledFn = throttle(mockFn, 300);

        throttledFn('call1');
        throttledFn('call2');
        throttledFn('call3');

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('call1');
    });

    it('should allow calls after the throttle period', () => {
        const mockFn = jest.fn();
        const throttledFn = throttle(mockFn, 200);

        throttledFn('first');
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('first');

        jest.advanceTimersByTime(201); // Advance slightly more than throttle period
        throttledFn('second');

        expect(mockFn).toHaveBeenCalledTimes(2);
        expect(mockFn).toHaveBeenLastCalledWith('second');
    });

    it('should pass correct arguments to throttled function', () => {
        const mockFn = jest.fn();
        const throttledFn = throttle(mockFn, 100);

        throttledFn(1, 2, 3);
        expect(mockFn).toHaveBeenCalledWith(1, 2, 3);

        jest.advanceTimersByTime(101);
        throttledFn('a', 'b', 'c');

        expect(mockFn).toHaveBeenCalledTimes(2);
        expect(mockFn).toHaveBeenLastCalledWith('a', 'b', 'c');
    });
});
