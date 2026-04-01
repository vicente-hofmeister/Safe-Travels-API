import type { FastifyInstance } from "fastify";
import { authController } from "./auth.controller.js";

export async function authRoutes(app: FastifyInstance) {
  app.get("/health", async () => authController());
}
