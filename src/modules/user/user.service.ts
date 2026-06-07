import {
  findUserById,
  searchUsers as repoSearchUsers,
  type UserRow,
} from "./user.repository.js";

export class UserError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "UserError";
  }
}

function mapUser(row: UserRow) {
  return {
    userId: row.user_id,
    username: row.username,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

export function userHealth() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "User service is healthy!",
  } as const;
}

export async function getUserById(userId: string) {
  if (!userId.trim()) throw new UserError(400, "userId é obrigatório.");

  const result = await findUserById(userId.trim());
  const user = result.rows[0];
  if (!user) throw new UserError(404, "Usuário não encontrado.");

  return {
    status: "ok",
    data: mapUser(user),
  } as const;
}

export async function searchUsers(q: string) {
  if (!q || q.trim().length < 2) {
    throw new UserError(400, "O termo de busca deve ter ao menos 2 caracteres.");
  }

  const result = await repoSearchUsers(q.trim());

  return {
    status: "ok",
    data: result.rows.map(mapUser),
  } as const;
}
