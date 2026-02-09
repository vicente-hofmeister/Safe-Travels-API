import { describe, it, expect } from "vitest";
import { userEcho } from "../src/modules/user/user.service";

describe("userEcho", () => {
  it("returns ok with message", () => {
    const r = userEcho();
    expect(r.status).toBe("ok");
    expect(typeof r.timestamp).toBe("string");
    expect(r.message).toBe("Hello from user service!");
  });
});
