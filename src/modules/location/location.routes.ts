import type { FastifyInstance } from "fastify";
import {
  locationController,
  registerLocationController,
  getLocationByIdController,
  getLocationByUserIdController,
  getLatestLocationPerUserController,
} from "./location.controller.js";
import type { RegisterLocationInput } from "./location.service.js";
import { verifyJwt } from "../../middleware/jwt.js";

type RegisterLocationBody = Omit<RegisterLocationInput, "userId">;

export async function locationRoutes(app: FastifyInstance) {
  app.get("/health", async () => locationController());

  app.post<{ Body: RegisterLocationBody }>("/register", { preHandler: [verifyJwt] }, async (request, reply) => {
    try {
      const input: RegisterLocationInput = {
        ...request.body,
        userId: request.user!.userId,
      };
      const result = await registerLocationController(input);
      reply.code(201);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        reply.code(400);
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
        message: "Erro interno ao registrar localizacao.",
      };
    }
  });

  app.get<{ Params: { locationEventId: string } }>(
    "/id/:locationEventId",
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      try {
        const result = await getLocationByIdController(request.params.locationEventId);

        if (!result) {
          reply.code(404);
          return {
            status: "error",
            timestamp: new Date().toISOString(),
            message: "Nenhuma localizacao encontrada para este id.",
          };
        }

        reply.code(200);
        return result;
      } catch (error) {
        if (error instanceof Error) {
          reply.code(400);
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
          message: "Erro interno ao buscar localizacao.",
        };
      }
    },
  );

  app.get<{ Querystring: { userIds?: string } }>("/latest", { preHandler: [verifyJwt] }, async (request, reply) => {
    try {
      const rawUserIds = request.query.userIds;
      const userIds = rawUserIds
        ? rawUserIds
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
        : undefined;

      const result = await getLatestLocationPerUserController(userIds);
      reply.code(200);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        reply.code(400);
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
        message: "Erro interno ao buscar localizacoes.",
      };
    }
  });

  app.get<{ Params: { userId: string } }>("/user/:userId", { preHandler: [verifyJwt] }, async (request, reply) => {
    try {
      const result = await getLocationByUserIdController(request.params.userId);

      if (!result) {
        reply.code(404);
        return {
          status: "error",
          timestamp: new Date().toISOString(),
          message: "Nenhuma localizacao encontrada para este userId.",
        };
      }

      reply.code(200);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        reply.code(400);
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
        message: "Erro interno ao buscar localizacao.",
      };
    }
  });
}
