import { describe, it, expect } from "vitest";
import { authEcho } from "../src/modules/auth/auth.service";

describe("authEcho", () => {
  it("returns ok with message", () => {
    const r = authEcho();
    expect(r.status).toBe("ok");
    expect(typeof r.timestamp).toBe("string");
    expect(r.message).toBe("Hello from auth service!");
  });
});
