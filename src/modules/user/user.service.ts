export function userEcho() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Hello from user service!",
  } as const;
}
