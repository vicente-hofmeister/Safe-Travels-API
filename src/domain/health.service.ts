export function healthCheck() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
  } as const;
}
