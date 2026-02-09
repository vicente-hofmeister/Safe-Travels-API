export function authEcho() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Hello from auth service!",
  } as const;
}
