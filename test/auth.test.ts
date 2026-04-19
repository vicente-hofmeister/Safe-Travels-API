import { describe, expect, it, vi } from "vitest";
import { AuthError, authHealth, loginUser, registerUser } from "../src/modules/auth/auth.service";

describe("authHealth", () => {
  it("returns ok with message", () => {
    const response = authHealth();

    expect(response.status).toBe("ok");
    expect(typeof response.timestamp).toBe("string");
    expect(response.message).toBe("Auth service is healthy!");
  });
});

describe("registerUser", () => {
  it("creates a user and returns a session token", async () => {
    const databaseQuery = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT user_id")) {
        return { rowCount: 0, rows: [] };
      }

      return {
        rowCount: 1,
        rows: [
          {
            user_id: "user-123",
            username: "vicente",
            name: "Vicente Hofmeister",
            email: "vicente@example.com",
            password_hash: "hashed-password",
            created_at: "2026-04-14T00:00:00.000Z",
            updated_at: "2026-04-14T00:00:00.000Z",
          },
        ],
      };
    });

    const passwordHash = vi.fn(async () => "hashed-password");
    const signToken = vi.fn(() => "jwt-token");

    const response = await registerUser(
      {
        name: "Vicente Hofmeister",
        username: "Vicente",
        email: "Vicente@Example.com",
        password: "strong-password",
      },
      {
        databaseQuery,
        passwordHash,
        signToken,
        saltRounds: 10,
        jwtSecret: "secret",
        jwtExpiresIn: "1h",
      },
    );

    expect(databaseQuery).toHaveBeenCalledTimes(2);
    expect(passwordHash).toHaveBeenCalledWith("strong-password", 10);
    expect(signToken).toHaveBeenCalledOnce();
    expect(response).toEqual({
      accessToken: "jwt-token",
      tokenType: "Bearer",
      expiresIn: "1h",
      user: {
        id: "user-123",
        username: "vicente",
        name: "Vicente Hofmeister",
        email: "vicente@example.com",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
      },
    });
  });

  it("rejects duplicated username or email", async () => {
    const databaseQuery = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT user_id")) {
        return {
          rowCount: 1,
          rows: [{ user_id: "user-123" }],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    await expect(
      registerUser(
        {
          name: "Vicente Hofmeister",
          username: "vicente",
          email: "vicente@example.com",
          password: "strong-password",
        },
        {
          databaseQuery,
          passwordHash: vi.fn(),
          signToken: vi.fn(),
          jwtSecret: "secret",
          jwtExpiresIn: "1h",
        },
      ),
    ).rejects.toMatchObject<AuthError>({
      statusCode: 409,
      message: "Username ou email já está em uso",
    });
  });
});

describe("loginUser", () => {
  it("authenticates a user and returns a session token", async () => {
    const databaseQuery = vi.fn(async () => {
      return {
        rowCount: 1,
        rows: [
          {
            user_id: "user-123",
            username: "vicente",
            name: "Vicente Hofmeister",
            email: "vicente@example.com",
            password_hash: "hashed-password",
            created_at: "2026-04-14T00:00:00.000Z",
            updated_at: "2026-04-14T00:00:00.000Z",
          },
        ],
      };
    });

    const passwordCompare = vi.fn(async () => true);
    const signToken = vi.fn(() => "jwt-token");

    const response = await loginUser(
      {
        email: "Vicente@Example.com",
        password: "strong-password",
      },
      {
        databaseQuery,
        passwordCompare,
        signToken,
        jwtSecret: "secret",
        jwtExpiresIn: "1h",
      },
    );

    expect(databaseQuery).toHaveBeenCalledOnce();
    expect(passwordCompare).toHaveBeenCalledWith("strong-password", "hashed-password");
    expect(response.accessToken).toBe("jwt-token");
    expect(response.user.email).toBe("vicente@example.com");
  });

  it("rejects invalid credentials", async () => {
    const databaseQuery = vi.fn(async () => ({ rowCount: 0, rows: [] }));

    await expect(
      loginUser(
        {
          email: "missing@example.com",
          password: "strong-password",
        },
        {
          databaseQuery,
          passwordCompare: vi.fn(),
          signToken: vi.fn(),
          jwtSecret: "secret",
          jwtExpiresIn: "1h",
        },
      ),
    ).rejects.toMatchObject<AuthError>({
      statusCode: 401,
      message: "Credenciais inválidas",
    });
  });
});
