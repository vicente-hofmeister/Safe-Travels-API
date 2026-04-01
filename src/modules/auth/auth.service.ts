export function authHealth() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Auth service is healthy!",
  } as const;
}
