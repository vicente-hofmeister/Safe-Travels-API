export function tripHealth() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Trip service is healthy!",
  } as const;
}
