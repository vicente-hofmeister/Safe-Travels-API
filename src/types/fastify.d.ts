import type { AuthenticatedUser } from "../middleware/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export {};
