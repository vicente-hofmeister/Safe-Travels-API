export function userHealth() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "User service is healthy!",
  } as const;
}
