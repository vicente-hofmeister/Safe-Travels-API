import { userHealth, getUserById, searchUsers } from "./user.service.js";

export function userController() {
  return userHealth();
}

export async function getUserByIdController(userId: string) {
  return getUserById(userId);
}

export async function searchUsersController(q: string) {
  return searchUsers(q);
}
