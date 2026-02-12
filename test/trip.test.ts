import { describe, it, expect } from "vitest";
import { tripEcho } from "../src/modules/trip/trip.service";

describe("tripEcho", () => {
  it("returns ok with message", () => {
    const r = tripEcho();
    expect(r.status).toBe("ok");
    expect(typeof r.timestamp).toBe("string");
    expect(r.message).toBe("Hello from trip service!");
  });
});
