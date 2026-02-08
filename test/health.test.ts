import { describe, it, expect } from "vitest";
import { healthCheck } from "../src/modules/health/health.service";

describe("healthCheck", () => {
  it("returns ok", () => {
    const r = healthCheck();
    expect(r.status).toBe("ok");
    expect(typeof r.timestamp).toBe("string");
  });
});
