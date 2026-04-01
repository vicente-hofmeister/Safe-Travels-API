import { describe, it, expect } from "vitest";
import { userHealth } from "../src/modules/user/user.service";

describe("userHealth", () => {
  it("returns ok with message", () => {
    const r = userHealth();
    expect(r.status).toBe("ok");
    expect(typeof r.timestamp).toBe("string");
    expect(r.message).toBe("User service is healthy!");
  });
});
