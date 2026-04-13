import type { FastifyInstance } from "fastify";
import { groupController } from "./group.controller.js";

export async function groupRoutes(app: FastifyInstance) {
  app.get("/health", async () => groupController());
}
