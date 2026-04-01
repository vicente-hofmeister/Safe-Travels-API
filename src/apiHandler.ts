import { healthCheck } from "./modules/health/health.service.js";
import { authHealth } from "./modules/auth/auth.service.js";
import { userHealth } from "./modules/user/user.service.js";
import { tripHealth } from "./modules/trip/trip.service.js";
import { groupHealth } from "./modules/group/group.service.js";
import { locationHealth } from "./modules/location/location.service.js";
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
    case "GET /auth/health":
      return json(authHealth());
    case "GET /user/health":
      return json(userHealth());
    case "GET /trip/health":
      return json(tripHealth());
    case "GET /group/health":
      return json(groupHealth());
    case "GET /location/health":
      return json(locationHealth());
    default:
      return json({ message: "Not Found" }, 404);
  }
}
