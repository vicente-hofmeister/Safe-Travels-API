import { describe, it, expect } from "vitest";
import { tripHealth } from "../src/modules/trip/trip.service";

describe("tripHealth", () => {
  it("returns ok with message", () => {
    const r = tripHealth();
    expect(r.status).toBe("ok");
    expect(typeof r.timestamp).toBe("string");
    expect(r.message).toBe("Trip service is healthy!");
  });
});
