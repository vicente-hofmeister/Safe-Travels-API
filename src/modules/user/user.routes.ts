import type { FastifyInstance } from "fastify";
import { userController } from "./user.controller.js";

export async function userRoutes(app: FastifyInstance) {
  app.get("/health", async () => userController());
}
