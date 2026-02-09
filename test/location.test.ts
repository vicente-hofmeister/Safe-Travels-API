import { describe, it, expect } from "vitest";
import { locationEcho } from "../src/modules/location/location.service";

describe("locationEcho", () => {
  it("returns ok with message", () => {
    const r = locationEcho();
    expect(r.status).toBe("ok");
    expect(typeof r.timestamp).toBe("string");
    expect(r.message).toBe("Hello from location service!");
  });
});
