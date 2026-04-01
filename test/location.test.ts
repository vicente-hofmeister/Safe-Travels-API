import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  locationHealth,
  validateRegisterLocationInput,
  validateLocationEventIdInput,
  validateUserIdInput,
  getLocationById,
  getLocationByUserId,
} from "../src/modules/location/location.service";
import * as db from "../src/config/database";

vi.mock("../src/config/database");

describe("locationHealth", () => {
  it("returns ok with message", () => {
    const r = locationHealth();
    expect(r.status).toBe("ok");
    expect(typeof r.timestamp).toBe("string");
    expect(r.message).toBe("Location service is healthy!");
  });
});

describe("validateRegisterLocationInput", () => {
  it("accepts a valid payload", () => {
    const payload = validateRegisterLocationInput({
      userId: "mock-user-123",
      latitude: -30.027704,
      longitude: -51.228732,
      accuracyMeters: 5,
      capturedAt: "2026-04-08T00:00:00.000Z",
    });

    expect(payload.userId).toBe("mock-user-123");
    expect(payload.latitude).toBe(-30.027704);
    expect(payload.longitude).toBe(-51.228732);
    expect(payload.accuracyMeters).toBe(5);
    expect(payload.capturedAt).toBe("2026-04-08T00:00:00.000Z");
  });

  it("throws when userId is missing", () => {
    expect(() =>
      validateRegisterLocationInput({
        userId: "",
        latitude: -30,
        longitude: -51,
      }),
    ).toThrow("userId e obrigatorio.");
  });

  it("throws when latitude is out of range", () => {
    expect(() =>
      validateRegisterLocationInput({
        userId: "mock-user",
        latitude: -91,
        longitude: -51,
      }),
    ).toThrow("latitude deve estar entre -90 e 90.");
  });
});

describe("validateUserIdInput", () => {
  it("accepts a valid userId", () => {
    const userId = validateUserIdInput("mock-user-123");
    expect(userId).toBe("mock-user-123");
  });

  it("trims whitespace from userId", () => {
    const userId = validateUserIdInput("  mock-user-123  ");
    expect(userId).toBe("mock-user-123");
  });

  it("throws when userId is empty", () => {
    expect(() => validateUserIdInput("")).toThrow("userId e obrigatorio.");
  });

  it("throws when userId is not a string", () => {
    expect(() => validateUserIdInput(123)).toThrow("userId e obrigatorio.");
  });
});

describe("validateLocationEventIdInput", () => {
  it("accepts a valid locationEventId", () => {
    const id = validateLocationEventIdInput("10");
    expect(id).toBe(10);
  });

  it("throws when locationEventId is invalid", () => {
    expect(() => validateLocationEventIdInput("abc")).toThrow(
      "locationEventId deve ser um inteiro maior que zero.",
    );
  });
});

describe("getLocationById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns location for a valid locationEventId", async () => {
    const mockLocation = {
      location_event_id: 1,
      user_id: "mock-user-123",
      latitude: "-30.027704",
      longitude: "-51.228732",
      accuracy_meters: 5,
      captured_at: "2026-04-08T00:00:00.000Z",
      created_at: "2026-04-08T00:00:00.000Z",
    };

    vi.mocked(db.query).mockResolvedValue({
      rows: [mockLocation],
      rowCount: 1,
      command: "SELECT",
    });

    const result = await getLocationById(1);

    expect(result.status).toBe("ok");
    expect(result.data.locationEventId).toBe(1);
    expect(result.data.userId).toBe("mock-user-123");
    expect(result.data.latitude).toBe(-30.027704);
    expect(result.data.longitude).toBe(-51.228732);
    expect(result.data.accuracyMeters).toBe(5);
  });

  it("returns null when locationEventId is not found", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: "SELECT",
    });

    await expect(getLocationById(999)).resolves.toBeNull();
  });

  it("throws when locationEventId is invalid", async () => {
    await expect(getLocationById("abc")).rejects.toThrow(
      "locationEventId deve ser um inteiro maior que zero.",
    );
  });
});

describe("getLocationByUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the latest location for a valid userId", async () => {
    const mockLocation = {
      location_event_id: 2,
      user_id: "mock-user-123",
      latitude: "-30.000000",
      longitude: "-51.000000",
      accuracy_meters: 7,
      captured_at: "2026-04-08T01:00:00.000Z",
      created_at: "2026-04-08T01:00:00.000Z",
    };

    vi.mocked(db.query).mockResolvedValue({
      rows: [mockLocation],
      rowCount: 1,
      command: "SELECT",
    });

    const result = await getLocationByUserId("mock-user-123");

    expect(result.status).toBe("ok");
    expect(result.data.locationEventId).toBe(2);
    expect(result.data.userId).toBe("mock-user-123");
    expect(result.data.latitude).toBe(-30);
    expect(result.data.longitude).toBe(-51);
  });

  it("returns null when user has no locations", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: "SELECT",
    });

    await expect(getLocationByUserId("non-existent-user")).resolves.toBeNull();
  });

  it("throws when userId is invalid", async () => {
    await expect(getLocationByUserId("")).rejects.toThrow("userId e obrigatorio.");
  });
});
