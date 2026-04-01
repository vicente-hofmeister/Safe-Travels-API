import { query } from "../../config/database.js";

export function locationHealth() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Location service is healthy!",
  } as const;
}

export type RegisterLocationInput = {
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt?: string;
};

export type FindLocationInput = {
  locationEventId?: number;
  userId?: string;
};

type RegisterLocationRow = {
  location_event_id: number;
  user_id: string;
  latitude: string;
  longitude: string;
  accuracy_meters: number | null;
  captured_at: string;
  created_at: string;
};

export function validateRegisterLocationInput(input: RegisterLocationInput) {
  if (!input || typeof input !== "object") {
    throw new Error("Body da requisicao invalido.");
  }

  if (typeof input.userId !== "string" || input.userId.trim().length === 0) {
    throw new Error("userId e obrigatorio.");
  }

  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new Error("latitude deve estar entre -90 e 90.");
  }

  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error("longitude deve estar entre -180 e 180.");
  }

  if (
    input.accuracyMeters !== undefined &&
    (!Number.isFinite(input.accuracyMeters) || input.accuracyMeters < 0)
  ) {
    throw new Error("accuracyMeters deve ser um numero maior ou igual a zero.");
  }

  if (input.capturedAt !== undefined && Number.isNaN(Date.parse(input.capturedAt))) {
    throw new Error("capturedAt deve ser uma data valida no formato ISO.");
  }

  return {
    userId: input.userId.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters,
    capturedAt: input.capturedAt,
  } as const;
}

export async function registerLocation(input: RegisterLocationInput) {
  const validatedInput = validateRegisterLocationInput(input);

  const result = await query<RegisterLocationRow>(
    `
      INSERT INTO location_events (user_id, latitude, longitude, accuracy_meters, captured_at)
      VALUES (
        $1,
        $2,
        $3,
        $4,
        COALESCE($5::timestamptz, now())
      )
      RETURNING
        location_event_id,
        user_id,
        latitude,
        longitude,
        accuracy_meters,
        captured_at,
        created_at
    `,
    [
      validatedInput.userId,
      validatedInput.latitude,
      validatedInput.longitude,
      validatedInput.accuracyMeters ?? null,
      validatedInput.capturedAt ?? null,
    ],
  );

  const inserted = result.rows[0];

  if (!inserted) {
    throw new Error("Falha ao registrar localizacao.");
  }

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Location event registered successfully.",
    data: {
      locationEventId: inserted.location_event_id,
      userId: inserted.user_id,
      latitude: Number(inserted.latitude),
      longitude: Number(inserted.longitude),
      accuracyMeters: inserted.accuracy_meters,
      capturedAt: inserted.captured_at,
      createdAt: inserted.created_at,
    },
  } as const;
}

export function validateLocationEventIdInput(locationEventId: unknown) {
  const parsed = Number(locationEventId);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("locationEventId deve ser um inteiro maior que zero.");
  }

  return parsed;
}

export function validateUserIdInput(userId: unknown) {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new Error("userId e obrigatorio.");
  }
  return userId.trim();
}

function mapLocationRow(location: RegisterLocationRow) {
  return {
    locationEventId: location.location_event_id,
    userId: location.user_id,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    accuracyMeters: location.accuracy_meters,
    capturedAt: location.captured_at,
    createdAt: location.created_at,
  };
}

export async function getLocationById(locationEventId: unknown) {
  const validatedLocationEventId = validateLocationEventIdInput(locationEventId);

  const result = await query<RegisterLocationRow>(
    `
      SELECT
        location_event_id,
        user_id,
        latitude,
        longitude,
        accuracy_meters,
        captured_at,
        created_at
      FROM location_events
      WHERE location_event_id = $1
      LIMIT 1
    `,
    [validatedLocationEventId],
  );

  const location = result.rows[0];

  if (!location) {
    return null;
  }

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Location found.",
    data: mapLocationRow(location),
  } as const;
}

export async function getLocationByUserId(userId: unknown) {
  const validatedUserId = validateUserIdInput(userId);

  const result = await query<RegisterLocationRow>(
    `
      SELECT
        location_event_id,
        user_id,
        latitude,
        longitude,
        accuracy_meters,
        captured_at,
        created_at
      FROM location_events
      WHERE user_id = $1
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    [validatedUserId],
  );

  const location = result.rows[0];

  if (!location) {
    return null;
  }

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Location found.",
    data: mapLocationRow(location),
  } as const;
}
