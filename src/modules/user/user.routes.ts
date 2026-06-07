import type { FastifyInstance, FastifyReply } from "fastify";
import { verifyJwt } from "../../middleware/jwt.js";
import { UserError } from "./user.service.js";
import {
  userController,
  getUserByIdController,
  searchUsersController,
} from "./user.controller.js";

function sendUserError(reply: FastifyReply, error: unknown) {
  if (error instanceof UserError) {
    reply.code(error.statusCode);
    return {
      status: "error",
      timestamp: new Date().toISOString(),
      message: error.message,
    };
  }
  reply.code(500);
  return {
    status: "error",
    timestamp: new Date().toISOString(),
    message: "Erro interno no servidor.",
  };
}

export async function userRoutes(app: FastifyInstance) {
  app.get("/health", async () => userController());

  app.get<{ Querystring: { q?: string } }>(
    "/search",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        return reply.send(await searchUsersController(request.query.q ?? ""));
      } catch (error) {
        return sendUserError(reply, error);
      }
    },
  );

  app.get<{ Params: { userId: string } }>(
    "/:userId",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        return reply.send(await getUserByIdController(request.params.userId));
      } catch (error) {
        return sendUserError(reply, error);
      }
    },
  );
}
