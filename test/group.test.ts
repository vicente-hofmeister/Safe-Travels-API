import { describe, it, expect } from "vitest";
import { groupEcho } from "../src/modules/group/group.service";

describe("groupEcho", () => {
  it("returns ok with message", () => {
    const r = groupEcho();
    expect(r.status).toBe("ok");
    expect(typeof r.timestamp).toBe("string");
    expect(r.message).toBe("Hello from group service!");
  });
});
