import { authHealth, loginUser, registerUser } from "./auth.service.js";

export function getAuthHealth() {
  return authHealth();
}

export async function registerAuth(input: unknown) {
  return registerUser(input);
}

export async function loginAuth(input: unknown) {
  return loginUser(input);
}
