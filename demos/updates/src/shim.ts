const nativeInterval = window.setInterval.bind(window);

window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => nativeInterval(handler, timeout === 300000 ? 4000 : timeout, ...args)) as typeof window.setInterval;
