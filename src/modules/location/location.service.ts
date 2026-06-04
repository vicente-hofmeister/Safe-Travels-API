import { query, withDatabaseTransaction } from "../../config/database.js";

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

type LocationRow = {
  location_event_id: number;
  user_id: string;
  username: string;
  name: string;
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

  return withDatabaseTransaction(async (client) => {
    // Verificar se o usuário tem contexto de trip ativa:
    // trip pessoal ativa OU membro de grupo que tem trip ativa
    const activeTripCheck = await client.query<{ trip_id: string }>(
      `SELECT ut.trip_id
       FROM user_trips ut
       JOIN trips t ON t.trip_id = ut.trip_id
       WHERE ut.user_id = $1
         AND t.ended_at IS NULL
         AND t.deleted_at IS NULL
       LIMIT 1`,
      [validatedInput.userId],
    );

    if (activeTripCheck.rows.length === 0) {
      return {
        status: "skipped",
        timestamp: new Date().toISOString(),
        message: "Nenhuma viagem ativa. Localizacao nao registrada.",
      } as const;
    }

    const result = await client.query<{
      location_event_id: number;
      user_id: string;
      latitude: string;
      longitude: string;
      accuracy_meters: number | null;
      captured_at: string;
      created_at: string;
    }>(
      `INSERT INTO location_events (user_id, latitude, longitude, accuracy_meters, captured_at)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
       RETURNING location_event_id, user_id, latitude, longitude, accuracy_meters, captured_at, created_at`,
      [
        validatedInput.userId,
        validatedInput.latitude,
        validatedInput.longitude,
        validatedInput.accuracyMeters ?? null,
        validatedInput.capturedAt ?? null,
      ],
    );

    const inserted = result.rows[0];
    if (!inserted) throw new Error("Falha ao registrar localizacao.");

    // Vincular apenas aos grupos que têm trip ativa
    const activeGroupsResult = await client.query<{ group_id: string }>(
      `SELECT DISTINCT gm.group_id
       FROM group_members gm
       JOIN trips t ON t.group_id = gm.group_id
       WHERE gm.user_id = $1
         AND t.ended_at IS NULL
         AND t.deleted_at IS NULL`,
      [validatedInput.userId],
    );

    if (activeGroupsResult.rows.length > 0) {
      const groupIds = activeGroupsResult.rows.map((r) => r.group_id);
      await client.query(
        `INSERT INTO location_event_groups (location_event_id, group_id)
         SELECT $1, unnest($2::varchar[])`,
        [inserted.location_event_id, groupIds],
      );
    }

    // Vincular às trips ativas do usuário
    const tripsResult = await client.query<{ trip_id: string }>(
      `SELECT ut.trip_id
       FROM user_trips ut
       JOIN trips t ON t.trip_id = ut.trip_id
       WHERE ut.user_id = $1
         AND t.ended_at IS NULL
         AND t.deleted_at IS NULL`,
      [validatedInput.userId],
    );

    if (tripsResult.rows.length > 0) {
      const tripIds = tripsResult.rows.map((r) => r.trip_id);
      await client.query(
        `INSERT INTO location_event_trips (location_event_id, trip_id)
         SELECT $1, unnest($2::varchar[])`,
        [inserted.location_event_id, tripIds],
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

export async function getLocationById(locationEventId: unknown) {
  const validatedLocationEventId = validateLocationEventIdInput(locationEventId);

  const result = await query<LocationRow>(
    `SELECT
       le.location_event_id,
       le.user_id,
       u.username,
       u.name,
       le.latitude,
       le.longitude,
       le.accuracy_meters,
       le.captured_at,
       le.created_at
     FROM location_events le
     JOIN users u ON u.user_id = le.user_id
     WHERE le.location_event_id = $1
     LIMIT 1`,
    [validatedLocationEventId],
  );

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
  // Retorna apenas usuários com trip ativa (pessoal ou de grupo)
  let result;

  if (userIds && userIds.length > 0) {
    result = await query<LocationRow>(
      `SELECT DISTINCT ON (le.user_id)
         le.location_event_id,
         le.user_id,
         u.username,
         u.name,
         le.latitude,
         le.longitude,
         le.accuracy_meters,
         le.captured_at,
         le.created_at
       FROM location_events le
       JOIN users u ON u.user_id = le.user_id
       WHERE le.user_id = ANY($1::text[])
         AND EXISTS (
           SELECT 1 FROM user_trips ut
           JOIN trips t ON t.trip_id = ut.trip_id
           WHERE ut.user_id = le.user_id
             AND t.ended_at IS NULL
             AND t.deleted_at IS NULL
         )
       ORDER BY le.user_id, le.captured_at DESC`,
      [userIds],
    );
  } else {
    result = await query<LocationRow>(
      `SELECT DISTINCT ON (le.user_id)
         le.location_event_id,
         le.user_id,
         u.username,
         u.name,
         le.latitude,
         le.longitude,
         le.accuracy_meters,
         le.captured_at,
         le.created_at
       FROM location_events le
       JOIN users u ON u.user_id = le.user_id
       WHERE EXISTS (
         SELECT 1 FROM user_trips ut
         JOIN trips t ON t.trip_id = ut.trip_id
         WHERE ut.user_id = le.user_id
           AND t.ended_at IS NULL
           AND t.deleted_at IS NULL
       )
       ORDER BY le.user_id, le.captured_at DESC`,
    );
  }

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Latest locations retrieved.",
    data: result.rows.map(mapLocationRow),
  } as const;
}

export async function getLocationByUserId(userId: unknown) {
  const validatedUserId = validateUserIdInput(userId);

  const result = await query<LocationRow>(
    `SELECT
       le.location_event_id,
       le.user_id,
       u.username,
       u.name,
       le.latitude,
       le.longitude,
       le.accuracy_meters,
       le.captured_at,
       le.created_at
     FROM location_events le
     JOIN users u ON u.user_id = le.user_id
     WHERE le.user_id = $1
     ORDER BY le.captured_at DESC
     LIMIT 1`,
    [validatedUserId],
  );

  const location = result.rows[0];
  if (!location) return null;

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Location found.",
    data: mapLocationRow(location),
  } as const;
}

type GroupLocationRow = {
  location_event_id: number;
  latitude: string;
  longitude: string;
  accuracy_meters: number | null;
  captured_at: string;
  created_at: string;
};

export async function getGroupLatestLocations(groupId: string) {
  if (!groupId.trim()) throw new Error("groupId e obrigatorio.");

  const groupCheck = await query<{ group_id: string }>(
    `SELECT group_id FROM groups WHERE group_id = $1 AND deleted_at IS NULL`,
    [groupId.trim()],
  );
  if (!groupCheck.rows[0]) return null;

  // Só retorna localização se o grupo tiver trip ativa
  const activeTripCheck = await query<{ trip_id: string }>(
    `SELECT trip_id FROM trips
     WHERE group_id = $1
       AND ended_at IS NULL
       AND deleted_at IS NULL
     LIMIT 1`,
    [groupId.trim()],
  );

  if (activeTripCheck.rows.length === 0) {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Grupo sem viagem ativa.",
      data: [],
    };
  }

  const result = await query<GroupLocationRow>(
    `SELECT DISTINCT ON (le.user_id)
       le.location_event_id,
       le.latitude,
       le.longitude,
       le.accuracy_meters,
       le.captured_at,
       le.created_at
     FROM location_events le
     JOIN location_event_groups leg ON leg.location_event_id = le.location_event_id
     WHERE leg.group_id = $1
     ORDER BY le.user_id, le.captured_at DESC`,
    [groupId.trim()],
  );

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
