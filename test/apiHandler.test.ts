import { describe, it, expect } from "vitest";
import { handler } from "../src/apiHandler";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

// Helper function to create a mock APIGatewayProxyEventV2
const createMockEvent = (method: string, path: string): APIGatewayProxyEventV2 => {
  return {
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "id.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "id",
      http: {
        method: method,
        path: path,
        protocol: "HTTP/1.1",
        sourceIp: "192.0.2.1",
        userAgent: "agent",
      },
      requestId: "id",
      routeKey: `${method} ${path}`,
      stage: "$default",
      time: "12/Mar/2020:19:03:58 +0000",
      timeEpoch: 1583348638390,
    },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
};

describe("handler", () => {
  describe("GET /health", () => {
    it("returns 200 with health check response", async () => {
      const event = createMockEvent("GET", "/health");
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({
        "Content-Type": "application/json; charset=utf-8",
      });

      const body = JSON.parse(response.body);
      expect(body.status).toBe("ok");
      expect(typeof body.timestamp).toBe("string");
    });
  });

  describe("GET /auth/health", () => {
    it("returns 200 with auth health response", async () => {
      const event = createMockEvent("GET", "/auth/health");
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({
        "Content-Type": "application/json; charset=utf-8",
      });

      const body = JSON.parse(response.body);
      expect(body.status).toBe("ok");
      expect(body.message).toBe("Auth service is healthy!");
      expect(typeof body.timestamp).toBe("string");
    });
  });

  describe("GET /user/health", () => {
    it("returns 200 with user health response", async () => {
      const event = createMockEvent("GET", "/user/health");
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({
        "Content-Type": "application/json; charset=utf-8",
      });

      const body = JSON.parse(response.body);
      expect(body.status).toBe("ok");
      expect(body.message).toBe("User service is healthy!");
      expect(typeof body.timestamp).toBe("string");
    });
  });

  describe("GET /trip/health", () => {
    it("returns 200 with trip health response", async () => {
      const event = createMockEvent("GET", "/trip/health");
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({
        "Content-Type": "application/json; charset=utf-8",
      });

      const body = JSON.parse(response.body);
      expect(body.status).toBe("ok");
      expect(body.message).toBe("Trip service is healthy!");
      expect(typeof body.timestamp).toBe("string");
    });
  });

  describe("GET /group/health", () => {
    it("returns 200 with group health response", async () => {
      const event = createMockEvent("GET", "/group/health");
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({
        "Content-Type": "application/json; charset=utf-8",
      });

      const body = JSON.parse(response.body);
      expect(body.status).toBe("ok");
      expect(body.message).toBe("Group service is healthy!");
      expect(typeof body.timestamp).toBe("string");
    });
  });

  describe("GET /location/health", () => {
    it("returns 200 with location health response", async () => {
      const event = createMockEvent("GET", "/location/health");
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({
        "Content-Type": "application/json; charset=utf-8",
      });

      const body = JSON.parse(response.body);
      expect(body.status).toBe("ok");
      expect(body.message).toBe("Location service is healthy!");
      expect(typeof body.timestamp).toBe("string");
    });
  });

  describe("404 Not Found", () => {
    it("returns 404 for unknown route", async () => {
      const event = createMockEvent("GET", "/unknown");
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      expect(response.headers).toEqual({
        "Content-Type": "application/json; charset=utf-8",
      });

      const body = JSON.parse(response.body);
      expect(body.message).toBe("Not Found");
    });

    it("returns 404 for POST on /health", async () => {
      const event = createMockEvent("POST", "/health");
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Not Found");
    });

    it("returns 404 for PUT on existing path", async () => {
      const event = createMockEvent("PUT", "/user/health");
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Not Found");
    });

    it("returns 404 for DELETE on non-existent path", async () => {
      const event = createMockEvent("DELETE", "/nonexistent");
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Not Found");
    });
  });
});
