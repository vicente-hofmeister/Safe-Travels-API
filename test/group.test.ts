import { describe, it, expect } from "vitest";
import { groupHealth } from "../src/modules/group/group.service";

describe("groupHealth", () => {
  it("returns ok with message", () => {
    const r = groupHealth();
    expect(r.status).toBe("ok");
    expect(typeof r.timestamp).toBe("string");
    expect(r.message).toBe("Group service is healthy!");
  });
});
