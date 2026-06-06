import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z as zod } from "zod";
import { authConfig } from "../../config/environment.js";
import {
  findUserByEmailOrUsername,
  findUserByEmail,
  insertUser,
  type AuthUserRecord,
} from "./auth.repository.js";

const registerSchema = zod.object({
  name: zod.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(150),
  username: zod
    .string()
    .trim()
    .min(3, "Username deve ter ao menos 3 caracteres")
    .max(80)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username pode conter apenas letras, números, ponto, sublinhado e hífen",
    )
    .transform((value) => value.toLowerCase()),
  email: zod
    .string()
    .trim()
    .email("Email inválido")
    .transform((value) => value.toLowerCase()),
  password: zod.string().min(8, "Senha deve ter ao menos 8 caracteres").max(128),
});

const loginSchema = zod.object({
  email: zod
    .string()
    .trim()
    .email("Email inválido")
    .transform((value) => value.toLowerCase()),
  password: zod.string().min(1, "Informe a senha"),
});

type PublicUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type AuthSession = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  user: PublicUser;
};

// Dependências injetáveis para facilitar testes unitários (bcrypt/jwt)
type AuthDependencies = {
  passwordHash?: typeof bcrypt.hash;
  passwordCompare?: typeof bcrypt.compare;
  signToken?: typeof jwt.sign;
  saltRounds?: number;
  jwtSecret?: string;
  jwtExpiresIn?: SignOptions["expiresIn"];
};

export class AuthError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function mapUser(record: AuthUserRecord): PublicUser {
  return {
    id: record.user_id,
    username: record.username,
    name: record.name,
    email: record.email,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function buildSession(
  user: PublicUser,
  accessToken: string,
  jwtExpiresIn: SignOptions["expiresIn"],
): AuthSession {
  return {
    user,
    accessToken,
    tokenType: "Bearer",
    expiresIn: String(jwtExpiresIn),
  };
}

function getDependencies(dependencies: AuthDependencies = {}) {
  return {
    passwordHash: dependencies.passwordHash ?? bcrypt.hash,
    passwordCompare: dependencies.passwordCompare ?? bcrypt.compare,
    signToken: dependencies.signToken ?? jwt.sign,
    saltRounds: dependencies.saltRounds ?? authConfig.bcryptSaltRounds,
    jwtSecret: dependencies.jwtSecret ?? authConfig.jwtSecret,
    jwtExpiresIn: dependencies.jwtExpiresIn ?? (authConfig.jwtExpiresIn as SignOptions["expiresIn"]),
  };
}

export function authHealth() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Auth service is healthy!",
  } as const;
}

export async function registerUser(input: unknown, dependencies: AuthDependencies = {}) {
  const payload = registerSchema.safeParse(input);
  if (!payload.success) {
    throw new AuthError(400, payload.error.issues[0]?.message ?? "Registro inválido");
  }

  const { passwordHash, signToken, saltRounds, jwtSecret, jwtExpiresIn } =
    getDependencies(dependencies);
  const { name, username, email, password } = payload.data;

  const existing = await findUserByEmailOrUsername(email, username);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new AuthError(409, "Username ou email já está em uso");
  }

  const passwordHashValue = await passwordHash(password, saltRounds);
  const created = await insertUser(username, name, email, passwordHashValue);
  const userRecord = created.rows[0];
  if (!userRecord) throw new AuthError(500, "Falha ao criar usuário");

  const user = mapUser(userRecord);
  const accessToken = signToken(
    { username: user.username, email: user.email },
    jwtSecret,
    { subject: user.id, expiresIn: jwtExpiresIn },
  );

  return buildSession(user, accessToken, jwtExpiresIn);
}

export async function loginUser(input: unknown, dependencies: AuthDependencies = {}) {
  const payload = loginSchema.safeParse(input);
  if (!payload.success) {
    throw new AuthError(400, payload.error.issues[0]?.message ?? "Login inválido");
  }

  const { passwordCompare, signToken, jwtSecret, jwtExpiresIn } = getDependencies(dependencies);
  const { email, password } = payload.data;

  const found = await findUserByEmail(email);
  const userRecord = found.rows[0];
  if (!userRecord) throw new AuthError(401, "Credenciais inválidas");

  const passwordMatches = await passwordCompare(password, userRecord.password_hash);
  if (!passwordMatches) throw new AuthError(401, "Credenciais inválidas");

  const user = mapUser(userRecord);
  const accessToken = signToken(
    { username: user.username, email: user.email },
    jwtSecret,
    { subject: user.id, expiresIn: jwtExpiresIn },
  );

  return buildSession(user, accessToken, jwtExpiresIn);
}
