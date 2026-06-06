import { withDatabaseTransaction } from "../../config/database.js";
import {
  findActiveTripForUser,
  insertLocationEvent,
  findActiveGroupsForUser,
  insertLocationEventGroups,
  findActiveTripsForUser,
  insertLocationEventTrips,
  findLocationById as repoFindLocationById,
  findLatestLocationsPerUser as repoFindLatest,
  findLatestLocationByUserId,
  findGroupById,
  findActiveTripForGroup,
  findLatestGroupLocations,
  type LocationRow,
} from "./location.repository.js";

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

export function validateRegisterLocationInput(input: RegisterLocationInput) {
  if (!input || typeof input !== "object") throw new Error("Body da requisicao invalido.");
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

function mapLocationRow(location: LocationRow) {
  return {
    locationEventId: location.location_event_id,
    user: {
      userId: location.user_id,
      username: location.username,
      name: location.name,
    },
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    accuracyMeters: location.accuracy_meters,
    capturedAt: location.captured_at,
    createdAt: location.created_at,
  };
}

export async function registerLocation(input: RegisterLocationInput) {
  const v = validateRegisterLocationInput(input);

  return withDatabaseTransaction(async (client) => {
    const activeTripCheck = await findActiveTripForUser(client, v.userId);
    if (activeTripCheck.rows.length === 0) {
      return {
        status: "skipped",
        timestamp: new Date().toISOString(),
        message: "Nenhuma viagem ativa. Localizacao nao registrada.",
      } as const;
    }

    const result = await insertLocationEvent(
      client,
      v.userId,
      v.latitude,
      v.longitude,
      v.accuracyMeters,
      v.capturedAt,
    );
    const inserted = result.rows[0];
    if (!inserted) throw new Error("Falha ao registrar localizacao.");

    const activeGroups = await findActiveGroupsForUser(client, v.userId);
    if (activeGroups.rows.length > 0) {
      await insertLocationEventGroups(
        client,
        inserted.location_event_id,
        activeGroups.rows.map((r) => r.group_id),
      );
    }

    const activeTrips = await findActiveTripsForUser(client, v.userId);
    if (activeTrips.rows.length > 0) {
      await insertLocationEventTrips(
        client,
        inserted.location_event_id,
        activeTrips.rows.map((r) => r.trip_id),
      );
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
  });
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

export async function getLocationById(locationEventId: unknown) {
  const validId = validateLocationEventIdInput(locationEventId);
  const result = await repoFindLocationById(validId);
  const location = result.rows[0];
  if (!location) return null;

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Location found.",
    data: mapLocationRow(location),
  } as const;
}

export async function getLatestLocationPerUser(userIds?: string[]) {
  const result = await repoFindLatest(userIds);

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Latest locations retrieved.",
    data: result.rows.map(mapLocationRow),
  } as const;
}

export async function getLocationByUserId(userId: unknown) {
  const validId = validateUserIdInput(userId);
  const result = await findLatestLocationByUserId(validId);
  const location = result.rows[0];
  if (!location) return null;

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Location found.",
    data: mapLocationRow(location),
  } as const;
}

export async function getGroupLatestLocations(groupId: string) {
  if (!groupId.trim()) throw new Error("groupId e obrigatorio.");

  const groupCheck = await findGroupById(groupId.trim());
  if (!groupCheck.rows[0]) return null;

  const activeTripCheck = await findActiveTripForGroup(groupId.trim());
  if (activeTripCheck.rows.length === 0) {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Grupo sem viagem ativa.",
      data: [],
    };
  }

  const result = await findLatestGroupLocations(groupId.trim());

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Localizacoes do grupo encontradas.",
    data: result.rows.map((row) => ({
      locationEventId: row.location_event_id,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      accuracyMeters: row.accuracy_meters,
      capturedAt: row.captured_at,
      createdAt: row.created_at,
    })),
  };
}
