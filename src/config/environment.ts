import "dotenv/config";

const jwtSecret =
  process.env.SAFE_TRAVELS_AUTH_JWT_SECRET ??
  process.env.AUTH_JWT_SECRET ??
  "safe-travels-dev-secret";

const jwtExpiresIn =
  process.env.SAFE_TRAVELS_AUTH_JWT_EXPIRES_IN ?? process.env.AUTH_JWT_EXPIRES_IN ?? "1h";

const bcryptSaltRounds = Number(
  process.env.SAFE_TRAVELS_AUTH_BCRYPT_SALT_ROUNDS ?? process.env.AUTH_BCRYPT_SALT_ROUNDS ?? 10,
);

export const authConfig = {
  jwtSecret,
  jwtExpiresIn,
  bcryptSaltRounds: Number.isFinite(bcryptSaltRounds) ? bcryptSaltRounds : 10,
} as const;
