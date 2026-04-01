import "./config/environment.js";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { pathToFileURL } from "node:url";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { groupRoutes } from "./modules/group/group.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { locationRoutes } from "./modules/location/location.routes.js";
import { tripRoutes } from "./modules/trip/trip.routes.js";
import { userRoutes } from "./modules/user/user.routes.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
  });

  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(userRoutes, { prefix: "/user" });
  await app.register(tripRoutes, { prefix: "/trip" });
  await app.register(groupRoutes, { prefix: "/group" });
  await app.register(locationRoutes, { prefix: "/location" });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ message: "Not Found" });
  });

  return app;
}

export async function startServer() {
  const app = await buildServer();

  await app.listen({ port, host });

  return app;
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startServer().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
