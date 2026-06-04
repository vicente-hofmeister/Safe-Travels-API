import { z as zod } from "zod";
import { query, withDatabaseTransaction } from "../../config/database.js";

// ---------------------------------------------------------------------------
// Schemas de validação
// ---------------------------------------------------------------------------

const createTripSchema = zod
  .object({
    name: zod.string().trim().min(1, "Nome da viagem é obrigatório").max(150),
    description: zod.string().trim().max(500).optional(),
    groupId: zod.string().trim().min(1).optional(),
    startedAt: zod.string().datetime({ message: "startedAt deve ser uma data ISO válida" }).optional(),
  })
  .refine(
    (data) => data.groupId !== undefined || data.groupId === undefined,
    // A regra "grupo OU individual" é imposta na camada de negócio,
    // não aqui — groupId é simplesmente opcional no input.
    { message: "Input inválido" },
  );

const addMemberSchema = zod.object({
  userId: zod.string().trim().min(1, "userId é obrigatório"),
});

// ---------------------------------------------------------------------------
// Tipos internos (linhas do banco)
// ---------------------------------------------------------------------------

type TripRow = {
  trip_id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_username: string;
  owner_name: string;
  group_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

type TripMemberRow = {
  user_id: string;
  username: string;
  name: string;
  joined_at: string;
};

type TripRoutePointRow = {
  location_event_id: number;
  latitude: string;
  longitude: string;
  accuracy_meters: number | null;
  captured_at: string;
};

// ---------------------------------------------------------------------------
// Erro de domínio
// ---------------------------------------------------------------------------

export class TripError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "TripError";
  }
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapTrip(row: TripRow) {
  return {
    tripId: row.trip_id,
    name: row.name,
    description: row.description,
    owner: {
      userId: row.owner_id,
      username: row.owner_username,
      name: row.owner_name,
    },
    groupId: row.group_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMember(row: TripMemberRow) {
  return {
    userId: row.user_id,
    username: row.username,
    name: row.name,
    joinedAt: row.joined_at,
  };
}

function mapRoutePoint(row: TripRoutePointRow) {
  return {
    locationEventId: row.location_event_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters: row.accuracy_meters,
    capturedAt: row.captured_at,
  };
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export function tripHealth() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Trip service is healthy!",
  } as const;
}

// ---------------------------------------------------------------------------
// Criar viagem
// ---------------------------------------------------------------------------

export async function createTrip(input: unknown, ownerUserId: string) {
  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) {
    throw new TripError(400, parsed.error.issues[0]?.message ?? "Input inválido");
  }

  const { name, description, groupId, startedAt } = parsed.data;

  return withDatabaseTransaction(async (client) => {
    // Se for viagem de grupo: verificar que o grupo existe e que o owner é membro
    if (groupId) {
      const groupCheck = await client.query<{ group_id: string; owner_id: string }>(
        `SELECT g.group_id, g.owner_id
         FROM groups g
         JOIN group_members gm ON gm.group_id = g.group_id AND gm.user_id = $2
         WHERE g.group_id = $1 AND g.deleted_at IS NULL`,
        [groupId, ownerUserId],
      );
      if (!groupCheck.rows[0]) {
        throw new TripError(404, "Grupo não encontrado ou você não é membro.");
      }
    }

    // Inserir a trip
    const result = await client.query<TripRow>(
      `INSERT INTO trips (name, description, owner_id, group_id, started_at)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
       RETURNING
         trip_id, name, description, owner_id, group_id,
         started_at, ended_at, created_at, updated_at`,
      [name, description ?? null, ownerUserId, groupId ?? null, startedAt ?? null],
    );

    const trip = result.rows[0];
    if (!trip) throw new TripError(500, "Falha ao criar viagem.");

    // Buscar dados do owner para o mapper
    const ownerResult = await client.query<{ username: string; name: string }>(
      `SELECT username, name FROM users WHERE user_id = $1`,
      [ownerUserId],
    );
    const owner = ownerResult.rows[0];
    if (!owner) throw new TripError(500, "Owner não encontrado.");

    const tripWithOwner: TripRow = {
      ...trip,
      owner_username: owner.username,
      owner_name: owner.name,
    };

    // Adicionar owner como primeiro membro
    await client.query(
      `INSERT INTO user_trips (trip_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [trip.trip_id, ownerUserId],
    );

    // Se for viagem de grupo: adicionar todos os membros atuais do grupo
    if (groupId) {
      await client.query(
        `INSERT INTO user_trips (trip_id, user_id)
         SELECT $1, gm.user_id
         FROM group_members gm
         WHERE gm.group_id = $2
         ON CONFLICT DO NOTHING`,
        [trip.trip_id, groupId],
      );
    }

    return {
      status: "ok",
      data: mapTrip(tripWithOwner),
    } as const;
  });
}

// ---------------------------------------------------------------------------
// Buscar viagem por ID (com membros e rota)
// ---------------------------------------------------------------------------

export async function getTripById(tripId: string) {
  const tripResult = await query<TripRow>(
    `SELECT
       t.trip_id, t.name, t.description, t.owner_id, t.group_id,
       t.started_at, t.ended_at, t.created_at, t.updated_at,
       u.username AS owner_username, u.name AS owner_name
     FROM trips t
     JOIN users u ON u.user_id = t.owner_id
     WHERE t.trip_id = $1 AND t.deleted_at IS NULL`,
    [tripId],
  );

  const trip = tripResult.rows[0];
  if (!trip) return null;

  const membersResult = await query<TripMemberRow>(
    `SELECT u.user_id, u.username, u.name, ut.joined_at
     FROM user_trips ut
     JOIN users u ON u.user_id = ut.user_id
     WHERE ut.trip_id = $1
     ORDER BY ut.joined_at ASC`,
    [tripId],
  );

  const routeResult = await query<TripRoutePointRow>(
    `SELECT le.location_event_id, le.latitude, le.longitude, le.accuracy_meters, le.captured_at
     FROM location_event_trips let_
     JOIN location_events le ON le.location_event_id = let_.location_event_id
     WHERE let_.trip_id = $1
     ORDER BY le.captured_at ASC`,
    [tripId],
  );

  return {
    status: "ok",
    data: {
      ...mapTrip(trip),
      members: membersResult.rows.map(mapMember),
      route: routeResult.rows.map(mapRoutePoint),
    },
  } as const;
}

// ---------------------------------------------------------------------------
// Listar viagens de um usuário
// ---------------------------------------------------------------------------

export async function getTripsByUserId(userId: string) {
  const result = await query<TripRow>(
    `SELECT
       t.trip_id, t.name, t.description, t.owner_id, t.group_id,
       t.started_at, t.ended_at, t.created_at, t.updated_at,
       u.username AS owner_username, u.name AS owner_name
     FROM trips t
     JOIN user_trips ut ON ut.trip_id = t.trip_id AND ut.user_id = $1
     JOIN users u ON u.user_id = t.owner_id
     WHERE t.deleted_at IS NULL
     ORDER BY t.started_at DESC`,
    [userId],
  );

  return {
    status: "ok",
    data: result.rows.map(mapTrip),
  } as const;
}

// ---------------------------------------------------------------------------
// Listar viagens de um grupo
// ---------------------------------------------------------------------------

export async function getTripsByGroupId(groupId: string) {
  // Verificar que o grupo existe
  const groupCheck = await query<{ group_id: string }>(
    `SELECT group_id FROM groups WHERE group_id = $1 AND deleted_at IS NULL`,
    [groupId],
  );
  if (!groupCheck.rows[0]) return null;

  const result = await query<TripRow>(
    `SELECT
       t.trip_id, t.name, t.description, t.owner_id, t.group_id,
       t.started_at, t.ended_at, t.created_at, t.updated_at,
       u.username AS owner_username, u.name AS owner_name
     FROM trips t
     JOIN users u ON u.user_id = t.owner_id
     WHERE t.group_id = $1 AND t.deleted_at IS NULL
     ORDER BY t.started_at DESC`,
    [groupId],
  );

  return {
    status: "ok",
    data: result.rows.map(mapTrip),
  } as const;
}

// ---------------------------------------------------------------------------
// Encerrar viagem (preenche ended_at)
// ---------------------------------------------------------------------------

export async function endTrip(tripId: string, requestingUserId: string) {
  const tripResult = await query<{ trip_id: string; owner_id: string; ended_at: string | null }>(
    `SELECT trip_id, owner_id, ended_at FROM trips WHERE trip_id = $1 AND deleted_at IS NULL`,
    [tripId],
  );

  const trip = tripResult.rows[0];
  if (!trip) throw new TripError(404, "Viagem não encontrada.");
  if (trip.owner_id !== requestingUserId) throw new TripError(403, "Apenas o dono pode encerrar a viagem.");
  if (trip.ended_at) throw new TripError(409, "Viagem já foi encerrada.");

  await query(
    `UPDATE trips SET ended_at = now(), updated_at = now() WHERE trip_id = $1`,
    [tripId],
  );

  return { status: "ok", message: "Viagem encerrada." } as const;
}

// ---------------------------------------------------------------------------
// Deletar viagem (soft delete)
// ---------------------------------------------------------------------------

export async function deleteTrip(tripId: string, requestingUserId: string) {
  const tripResult = await query<{ trip_id: string; owner_id: string }>(
    `SELECT trip_id, owner_id FROM trips WHERE trip_id = $1 AND deleted_at IS NULL`,
    [tripId],
  );

  const trip = tripResult.rows[0];
  if (!trip) throw new TripError(404, "Viagem não encontrada.");
  if (trip.owner_id !== requestingUserId) throw new TripError(403, "Apenas o dono pode deletar a viagem.");

  await query(
    `UPDATE trips SET deleted_at = now(), updated_at = now() WHERE trip_id = $1`,
    [tripId],
  );

  return { status: "ok", message: "Viagem removida." } as const;
}

// ---------------------------------------------------------------------------
// Adicionar membro
// ---------------------------------------------------------------------------

export async function addTripMember(tripId: string, input: unknown, requestingUserId: string) {
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    throw new TripError(400, parsed.error.issues[0]?.message ?? "Input inválido");
  }

  const { userId } = parsed.data;

  const tripResult = await query<{ trip_id: string; owner_id: string; group_id: string | null; ended_at: string | null }>(
    `SELECT trip_id, owner_id, group_id, ended_at FROM trips WHERE trip_id = $1 AND deleted_at IS NULL`,
    [tripId],
  );

  const trip = tripResult.rows[0];
  if (!trip) throw new TripError(404, "Viagem não encontrada.");
  if (trip.owner_id !== requestingUserId) throw new TripError(403, "Apenas o dono pode adicionar membros.");
  if (trip.ended_at) throw new TripError(409, "Não é possível adicionar membros a uma viagem encerrada.");

  // Verificar que o usuário existe
  const userCheck = await query<{ user_id: string }>(
    `SELECT user_id FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  if (!userCheck.rows[0]) throw new TripError(404, "Usuário não encontrado.");

  await query(
    `INSERT INTO user_trips (trip_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [tripId, userId],
  );

  return { status: "ok", message: "Membro adicionado." } as const;
}

// ---------------------------------------------------------------------------
// Remover membro
// ---------------------------------------------------------------------------

export async function removeTripMember(tripId: string, userId: string, requestingUserId: string) {
  const tripResult = await query<{ trip_id: string; owner_id: string; ended_at: string | null }>(
    `SELECT trip_id, owner_id, ended_at FROM trips WHERE trip_id = $1 AND deleted_at IS NULL`,
    [tripId],
  );

  const trip = tripResult.rows[0];
  if (!trip) throw new TripError(404, "Viagem não encontrada.");

  const isSelf = userId === requestingUserId;
  const isOwner = trip.owner_id === requestingUserId;

  // Owner não pode remover a si mesmo: deve deletar a viagem
  if (isSelf && isOwner) {
    throw new TripError(403, "O dono não pode sair da viagem. Delete a viagem se quiser encerrá-la.");
  }

  // Apenas owner pode remover outros; qualquer membro pode sair
  if (!isSelf && !isOwner) {
    throw new TripError(403, "Sem permissão para remover este membro.");
  }

  const deleteResult = await query(
    `DELETE FROM user_trips WHERE trip_id = $1 AND user_id = $2`,
    [tripId, userId],
  );

  if ((deleteResult.rowCount ?? 0) === 0) {
    throw new TripError(404, "Membro não encontrado nesta viagem.");
  }

  return { status: "ok", message: "Membro removido." } as const;
}
