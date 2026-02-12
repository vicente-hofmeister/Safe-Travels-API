export function groupEcho() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Hello from group service!",
  } as const;
}
