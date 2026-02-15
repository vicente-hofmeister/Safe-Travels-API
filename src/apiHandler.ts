import { healthCheck } from "./domain/health.service.js";
import { authEcho } from "./domain/auth.service.js";
import { userEcho } from "./domain/user.service.js";
import { tripEcho } from "./domain/trip.service.js";
import { groupEcho } from "./domain/group.service.js";
import { locationEcho } from "./domain/location.service.js";
import type { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";

const json = (body: unknown, statusCode = 200): APIGatewayProxyResult => ({
  statusCode,
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const path = event.rawPath;
  const method = event.requestContext.http.method;

  switch (`${method} ${path}`) {
    case "GET /health":
      return json(healthCheck());
    case "GET /auth/echo":
      return json(authEcho());
    case "GET /user/echo":
      return json(userEcho());
    case "GET /trip/echo":
      return json(tripEcho());
    case "GET /group/echo":
      return json(groupEcho());
    case "GET /location/echo":
      return json(locationEcho());
    default:
      return json({ message: "Not Found" }, 404);
  }
}
