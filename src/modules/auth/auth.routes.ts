import type { FastifyInstance, FastifyReply } from "fastify";
import { getAuthHealth, loginAuth, registerAuth } from "./auth.controller.js";
import { AuthError } from "./auth.service.js";

async function sendAuthHandlerError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthError) {
    return reply.code(error.statusCode).send({ message: error.message });
  }

  throw error;
}

export async function authRoutes(app: FastifyInstance) {
  app.get("/health", async () => getAuthHealth());

  app.post("/register", async (request, reply) => {
    try {
      return reply.code(201).send(await registerAuth(request.body));
    } catch (error) {
      return sendAuthHandlerError(reply, error);
    }
  });

  app.post("/login", async (request, reply) => {
    try {
      return reply.send(await loginAuth(request.body));
    } catch (error) {
      return sendAuthHandlerError(reply, error);
    }
  });
}
