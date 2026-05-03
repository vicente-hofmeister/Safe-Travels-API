import type { FastifyInstance, FastifyReply } from "fastify";
import { verifyJwt } from "../../middleware/jwt.js";
import {
  groupController,
  createGroupController,
  getGroupByIdController,
  addGroupMemberController,
  removeGroupMemberController,
  getGroupsByUserIdController,
  deleteGroupController,
  getGroupLatestLocationsController,
} from "./group.controller.js";
import { GroupError } from "./group.service.js";

function sendGroupHandlerError(reply: FastifyReply, error: unknown) {
  if (error instanceof GroupError) {
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

export async function groupRoutes(app: FastifyInstance) {
  app.get("/health", async () => groupController());

  app.post("/", { preHandler: [verifyJwt] }, async (request, reply) => {
    try {
      const result = await createGroupController(request.body, request.user!.userId);
      reply.code(201);
      return result;
    } catch (error) {
      return sendGroupHandlerError(reply, error);
    }
  });

  app.get<{ Params: { groupId: string } }>(
    "/:groupId",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await getGroupByIdController(request.params.groupId);
        if (!result) {
          reply.code(404);
          return {
            status: "error",
            timestamp: new Date().toISOString(),
            message: "Grupo nao encontrado.",
          };
        }
        reply.code(200);
        return result;
      } catch (error) {
        return sendGroupHandlerError(reply, error);
      }
    },
  );

  app.post<{ Params: { groupId: string } }>(
    "/:groupId/members",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await addGroupMemberController(
          request.params.groupId,
          request.body,
          request.user!.userId,
        );
        reply.code(201);
        return result;
      } catch (error) {
        return sendGroupHandlerError(reply, error);
      }
    },
  );

  app.delete<{ Params: { groupId: string; userId: string } }>(
    "/:groupId/members/:userId",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await removeGroupMemberController(
          request.params.groupId,
          request.params.userId,
          request.user!.userId,
        );
        reply.code(200);
        return result;
      } catch (error) {
        return sendGroupHandlerError(reply, error);
      }
    },
  );

  app.get<{ Params: { userId: string } }>(
    "/user/:userId",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await getGroupsByUserIdController(request.params.userId);
        reply.code(200);
        return result;
      } catch (error) {
        return sendGroupHandlerError(reply, error);
      }
    },
  );

  app.delete<{ Params: { groupId: string } }>(
    "/:groupId",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await deleteGroupController(
          request.params.groupId,
          request.user!.userId,
        );
        reply.code(200);
        return result;
      } catch (error) {
        return sendGroupHandlerError(reply, error);
      }
    },
  );

  app.get<{ Params: { groupId: string } }>(
    "/:groupId/location",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await getGroupLatestLocationsController(request.params.groupId);
        if (!result) {
          reply.code(404);
          return {
            status: "error",
            timestamp: new Date().toISOString(),
            message: "Grupo nao encontrado.",
          };
        }
        reply.code(200);
        return result;
      } catch (error) {
        return sendGroupHandlerError(reply, error);
      }
    },
  );
}
