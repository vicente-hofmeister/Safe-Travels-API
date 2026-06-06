import { z as zod } from "zod";
import { withDatabaseTransaction } from "../../config/database.js";
import {
  findGroupMembership,
  insertTrip,
  findUserForTrip,
  insertUserTrip,
  insertGroupMembersAsTrip,
  findTripWithOwner,
  findTripMembers,
  findTripRoute,
  findTripsByUserId as repoFindTripsByUserId,
  findGroupById,
  findTripsByGroupId as repoFindTripsByGroupId,
  findTripForUpdate,
  endTrip as repoEndTrip,
  softDeleteTrip,
  findUserExists,
  insertTripMember,
  findTripForOwnerCheck,
  deleteTripMember,
  type TripRow,
  type TripMemberRow,
  type TripRoutePointRow,
} from "./trip.repository.js";

const createTripSchema = zod
  .object({
    name: zod.string().trim().min(1, "Nome da viagem é obrigatório").max(150),
    description: zod.string().trim().max(500).optional(),
    groupId: zod.string().trim().min(1).optional(),
    startedAt: zod.string().datetime({ message: "startedAt deve ser uma data ISO válida" }).optional(),
  });

const addMemberSchema = zod.object({
  userId: zod.string().trim().min(1, "userId é obrigatório"),
});

export class TripError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "TripError";
  }
}

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

export function tripHealth() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Trip service is healthy!",
  } as const;
}

export async function createTrip(input: unknown, ownerUserId: string) {
  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) {
    throw new TripError(400, parsed.error.issues[0]?.message ?? "Input inválido");
  }

  const { name, description, groupId, startedAt } = parsed.data;

  return withDatabaseTransaction(async (client) => {
    if (groupId) {
      const groupCheck = await findGroupMembership(client, groupId, ownerUserId);
      if (!groupCheck.rows[0]) {
        throw new TripError(404, "Grupo não encontrado ou você não é membro.");
      }
    }

    const result = await insertTrip(
      client,
      name,
      description ?? null,
      ownerUserId,
      groupId ?? null,
      startedAt ?? null,
    );
    const trip = result.rows[0];
    if (!trip) throw new TripError(500, "Falha ao criar viagem.");

    const ownerResult = await findUserForTrip(client, ownerUserId);
    const owner = ownerResult.rows[0];
    if (!owner) throw new TripError(500, "Owner não encontrado.");

    const tripWithOwner: TripRow = {
      ...trip,
      owner_username: owner.username,
      owner_name: owner.name,
    };

    await insertUserTrip(client, trip.trip_id, ownerUserId);

    if (groupId) {
      await insertGroupMembersAsTrip(client, trip.trip_id, groupId);
    }

    return { status: "ok", data: mapTrip(tripWithOwner) } as const;
  });
}

export async function getTripById(tripId: string) {
  const tripResult = await findTripWithOwner(tripId);
  const trip = tripResult.rows[0];
  if (!trip) return null;

  const membersResult = await findTripMembers(tripId);
  const routeResult = await findTripRoute(tripId);

  return {
    status: "ok",
    data: {
      ...mapTrip(trip),
      members: membersResult.rows.map(mapMember),
      route: routeResult.rows.map(mapRoutePoint),
    },
  } as const;
}

export async function getTripsByUserId(userId: string) {
  const result = await repoFindTripsByUserId(userId);
  return { status: "ok", data: result.rows.map(mapTrip) } as const;
}

export async function getTripsByGroupId(groupId: string) {
  const groupCheck = await findGroupById(groupId);
  if (!groupCheck.rows[0]) return null;

  const result = await repoFindTripsByGroupId(groupId);
  return { status: "ok", data: result.rows.map(mapTrip) } as const;
}

export async function endTrip(tripId: string, requestingUserId: string) {
  const tripResult = await findTripForUpdate(tripId);
  const trip = tripResult.rows[0];
  if (!trip) throw new TripError(404, "Viagem não encontrada.");
  if (trip.owner_id !== requestingUserId) throw new TripError(403, "Apenas o dono pode encerrar a viagem.");
  if (trip.ended_at) throw new TripError(409, "Viagem já foi encerrada.");

  await repoEndTrip(tripId);
  return { status: "ok", message: "Viagem encerrada." } as const;
}

export async function deleteTrip(tripId: string, requestingUserId: string) {
  const tripResult = await findTripForUpdate(tripId);
  const trip = tripResult.rows[0];
  if (!trip) throw new TripError(404, "Viagem não encontrada.");
  if (trip.owner_id !== requestingUserId) throw new TripError(403, "Apenas o dono pode deletar a viagem.");

  await softDeleteTrip(tripId);
  return { status: "ok", message: "Viagem removida." } as const;
}

export async function addTripMember(tripId: string, input: unknown, requestingUserId: string) {
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    throw new TripError(400, parsed.error.issues[0]?.message ?? "Input inválido");
  }

  const { userId } = parsed.data;

  const tripResult = await findTripForOwnerCheck(tripId);
  const trip = tripResult.rows[0];
  if (!trip) throw new TripError(404, "Viagem não encontrada.");
  if (trip.owner_id !== requestingUserId) throw new TripError(403, "Apenas o dono pode adicionar membros.");
  if (trip.ended_at) throw new TripError(409, "Não é possível adicionar membros a uma viagem encerrada.");

  const userCheck = await findUserExists(userId);
  if (!userCheck.rows[0]) throw new TripError(404, "Usuário não encontrado.");

  await insertTripMember(tripId, userId);
  return { status: "ok", message: "Membro adicionado." } as const;
}

export async function removeTripMember(tripId: string, userId: string, requestingUserId: string) {
  const tripResult = await findTripForUpdate(tripId);
  const trip = tripResult.rows[0];
  if (!trip) throw new TripError(404, "Viagem não encontrada.");

  const isSelf = userId === requestingUserId;
  const isOwner = trip.owner_id === requestingUserId;

  if (isSelf && isOwner) {
    throw new TripError(403, "O dono não pode sair da viagem. Delete a viagem se quiser encerrá-la.");
  }
  if (!isSelf && !isOwner) {
    throw new TripError(403, "Sem permissão para remover este membro.");
  }

  const deleteResult = await deleteTripMember(tripId, userId);
  if ((deleteResult.rowCount ?? 0) === 0) {
    throw new TripError(404, "Membro não encontrado nesta viagem.");
  }

  return { status: "ok", message: "Membro removido." } as const;
}
