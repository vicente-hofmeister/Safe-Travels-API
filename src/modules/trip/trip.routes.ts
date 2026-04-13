import type { FastifyInstance } from "fastify";
import { tripController } from "./trip.controller.js";

export async function tripRoutes(app: FastifyInstance) {
  app.get("/health", async () => tripController());
}
