export function locationEcho() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Hello from location service!",
  } as const;
}
