import { describe, it, expect } from "vitest";
import { authHealth } from "../src/modules/auth/auth.service";

describe("authHealth", () => {
  it("returns ok with message", () => {
    const r = authHealth();
    expect(r.status).toBe("ok");
    expect(typeof r.timestamp).toBe("string");
    expect(r.message).toBe("Auth service is healthy!");
  });
});
