/**
 * Throttle function to limit the rate at which a function can fire.
 * Unlike debounce, throttle guarantees a constant flow of executions every X milliseconds.
 * Perfect for resize handlers and scroll events.
 *
 * @param func - The function to throttle
 * @param limit - The time limit in milliseconds
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    let lastFunc: ReturnType<typeof setTimeout>;
    let lastRan: number;

    return function (this: any, ...args: Parameters<T>) {
        if (!inThrottle) {
            func.apply(this, args);
            lastRan = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if (Date.now() - lastRan >= limit) {
                    func.apply(this, args);
                    lastRan = Date.now();
                }
            }, Math.max(limit - (Date.now() - lastRan), 0));
        }
    };
}