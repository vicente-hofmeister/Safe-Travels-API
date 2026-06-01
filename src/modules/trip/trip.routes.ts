import type { FastifyInstance, FastifyReply } from "fastify";
import { verifyJwt } from "../../middleware/jwt.js";
import { TripError } from "./trip.service.js";
import {
  tripHealthController,
  createTripController,
  getTripByIdController,
  getTripsByUserIdController,
  getTripsByGroupIdController,
  endTripController,
  deleteTripController,
  addTripMemberController,
  removeTripMemberController,
} from "./trip.controller.js";

function sendTripError(reply: FastifyReply, error: unknown) {
  if (error instanceof TripError) {
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

export async function tripRoutes(app: FastifyInstance) {
  // Health check (público)
  app.get("/health", async () => tripHealthController());

  // Criar viagem
  app.post("/", { preHandler: [verifyJwt] }, async (request, reply) => {
    try {
      const result = await createTripController(request.body, request.user!.userId);
      reply.code(201);
      return result;
    } catch (error) {
      return sendTripError(reply, error);
    }
  });

  // Buscar viagem por ID (com membros e rota)
  app.get<{ Params: { tripId: string } }>(
    "/:tripId",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await getTripByIdController(request.params.tripId);
        if (!result) {
          reply.code(404);
          return { status: "error", timestamp: new Date().toISOString(), message: "Viagem não encontrada." };
        }
        reply.code(200);
        return result;
      } catch (error) {
        return sendTripError(reply, error);
      }
    },
  );

  // Listar viagens de um usuário
  app.get<{ Params: { userId: string } }>(
    "/user/:userId",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await getTripsByUserIdController(request.params.userId);
        reply.code(200);
        return result;
      } catch (error) {
        return sendTripError(reply, error);
      }
    },
  );

  // Listar viagens de um grupo
  app.get<{ Params: { groupId: string } }>(
    "/group/:groupId",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await getTripsByGroupIdController(request.params.groupId);
        if (!result) {
          reply.code(404);
          return { status: "error", timestamp: new Date().toISOString(), message: "Grupo não encontrado." };
        }
        reply.code(200);
        return result;
      } catch (error) {
        return sendTripError(reply, error);
      }
    },
  );

  // Encerrar viagem (preenche ended_at) — PATCH pois é atualização parcial do recurso
  app.patch<{ Params: { tripId: string } }>(
    "/:tripId/end",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await endTripController(request.params.tripId, request.user!.userId);
        reply.code(200);
        return result;
      } catch (error) {
        return sendTripError(reply, error);
      }
    },
  );

  // Adicionar membro
  app.post<{ Params: { tripId: string } }>(
    "/:tripId/members",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await addTripMemberController(
          request.params.tripId,
          request.body,
          request.user!.userId,
        );
        reply.code(201);
        return result;
      } catch (error) {
        return sendTripError(reply, error);
      }
    },
  );

  // Remover membro / sair da viagem
  app.delete<{ Params: { tripId: string; userId: string } }>(
    "/:tripId/members/:userId",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await removeTripMemberController(
          request.params.tripId,
          request.params.userId,
          request.user!.userId,
        );
        reply.code(200);
        return result;
      } catch (error) {
        return sendTripError(reply, error);
      }
    },
  );

  // Deletar viagem (soft delete)
  app.delete<{ Params: { tripId: string } }>(
    "/:tripId",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await deleteTripController(request.params.tripId, request.user!.userId);
        reply.code(200);
        return result;
      } catch (error) {
        return sendTripError(reply, error);
      }
    },
  );
}
