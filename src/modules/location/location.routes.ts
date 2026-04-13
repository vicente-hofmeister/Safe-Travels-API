import type { FastifyInstance } from "fastify";
import {
  locationController,
  registerLocationController,
  getLocationByIdController,
  getLocationByUserIdController,
} from "./location.controller.js";
import type { RegisterLocationInput } from "./location.service.js";

export async function locationRoutes(app: FastifyInstance) {
  app.get("/health", async () => locationController());

  app.post<{ Body: RegisterLocationInput }>("/register", async (request, reply) => {
    try {
      const result = await registerLocationController(request.body);
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

  app.get<{ Params: { userId: string } }>("/user/:userId", async (request, reply) => {
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
