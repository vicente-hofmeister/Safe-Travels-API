export function groupHealth() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Group service is healthy!",
  } as const;
}
