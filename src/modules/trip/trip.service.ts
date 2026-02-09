export function tripEcho() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Hello from trip service!",
  } as const;
}