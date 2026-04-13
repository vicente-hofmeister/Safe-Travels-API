import type { FastifyInstance } from "fastify";
import { healthController } from "./health.controller.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async () => healthController());
}
