type Level = "debug" | "info" | "warn" | "error";

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function makeLogger(level: Level) {
  const min = order[level] ?? order.info;

  function should(l: Level) {
    return order[l] >= min;
  }

  return {
    debug: (...args: unknown[]) => should("debug") && console.debug(...args),
    info: (...args: unknown[]) => should("info") && console.info(...args),
    warn: (...args: unknown[]) => should("warn") && console.warn(...args),
    error: (...args: unknown[]) => should("error") && console.error(...args),
  };
}
