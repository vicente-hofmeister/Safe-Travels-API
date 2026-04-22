import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import { authConfig } from "../config/environment.js";

type JwtPayload = {
  sub: string;
  username: string;
  email: string;
};

export type AuthenticatedUser = {
  userId: string;
  username: string;
  email: string;
};

export async function verifyJwt(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.code(401).send({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Token de autenticacao nao fornecido.",
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret) as JwtPayload;
    request.user = {
      userId: decoded.sub,
      username: decoded.username,
      email: decoded.email,
    };
  } catch {
    return reply.code(401).send({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Token invalido ou expirado.",
    });
  }
}
