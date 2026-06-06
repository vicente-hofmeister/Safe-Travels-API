import { z as zod } from "zod";
import { withDatabaseTransaction } from "../../config/database.js";
import {
  insertGroup,
  insertGroupMember,
  findOwnerForGroup,
  findGroupOwner,
  findGroupWithOwner,
  findGroupMembers,
  findGroupsByUserId,
  deleteGroupMember,
  softDeleteGroup,
  upsertGroupMember,
  type GroupRow,
  type GroupListRow,
  type MemberRow,
} from "./group.repository.js";

const createGroupSchema = zod.object({
  name: zod.string().trim().min(1, "Nome do grupo e obrigatorio").max(150),
  description: zod.string().trim().max(500).optional(),
});

const addMemberSchema = zod.object({
  userId: zod.string().trim().min(1, "userId e obrigatorio"),
});

export class GroupError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "GroupError";
  }
}

function mapGroup(row: GroupRow) {
  return {
    groupId: row.group_id,
    name: row.name,
    description: row.description,
    owner: {
      userId: row.owner_id,
      username: row.owner_username,
      name: row.owner_name,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMember(row: MemberRow) {
  return {
    userId: row.user_id,
    username: row.username,
    name: row.name,
    joinedAt: row.joined_at,
  };
}

export function groupHealth() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Group service is healthy!",
  } as const;
}

export async function createGroup(input: unknown, ownerUserId: string) {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    throw new GroupError(400, parsed.error.issues[0]?.message ?? "Input invalido");
  }

  const { name, description } = parsed.data;

  return withDatabaseTransaction(async (client) => {
    const groupResult = await insertGroup(client, name, description ?? null, ownerUserId);
    const groupRow = groupResult.rows[0];
    if (!groupRow) throw new GroupError(500, "Falha ao criar grupo");

    await insertGroupMember(client, groupRow.group_id, ownerUserId);

    const ownerResult = await findOwnerForGroup(client, ownerUserId);
    const owner = ownerResult.rows[0];

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Grupo criado com sucesso.",
      data: {
        groupId: groupRow.group_id,
        name: groupRow.name,
        description: groupRow.description,
        owner: {
          userId: ownerUserId,
          username: owner?.username ?? "",
          name: owner?.name ?? "",
        },
        createdAt: groupRow.created_at,
        updatedAt: groupRow.updated_at,
      },
    };
  });
}

export async function getGroupById(groupId: string) {
  if (!groupId.trim()) throw new GroupError(400, "groupId e obrigatorio");

  const groupResult = await findGroupWithOwner(groupId);
  const groupRow = groupResult.rows[0];
  if (!groupRow) return null;

  const membersResult = await findGroupMembers(groupId);

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Grupo encontrado.",
    data: {
      ...mapGroup(groupRow),
      members: membersResult.rows.map(mapMember),
    },
  };
}

export async function addGroupMember(groupId: string, input: unknown, requesterUserId: string) {
  if (!groupId.trim()) throw new GroupError(400, "groupId e obrigatorio");

  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    throw new GroupError(400, parsed.error.issues[0]?.message ?? "Input invalido");
  }

  const { userId } = parsed.data;

  const groupResult = await findGroupOwner(groupId);
  const group = groupResult.rows[0];
  if (!group) throw new GroupError(404, "Grupo nao encontrado");
  if (group.owner_id !== requesterUserId) {
    throw new GroupError(403, "Apenas o owner pode adicionar membros");
  }

  await upsertGroupMember(groupId, userId);

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Membro adicionado com sucesso.",
  };
}

export async function removeGroupMember(
  groupId: string,
  targetUserId: string,
  requesterUserId: string,
) {
  if (!groupId.trim()) throw new GroupError(400, "groupId e obrigatorio");
  if (!targetUserId.trim()) throw new GroupError(400, "userId e obrigatorio");

  const groupResult = await findGroupOwner(groupId);
  const group = groupResult.rows[0];
  if (!group) throw new GroupError(404, "Grupo nao encontrado");

  const isOwner = group.owner_id === requesterUserId;
  const isSelf = targetUserId === requesterUserId;

  if (!isOwner && !isSelf) throw new GroupError(403, "Sem permissao para remover este membro");
  if (isOwner && isSelf) {
    throw new GroupError(400, "O owner nao pode sair do grupo. Delete o grupo para encerrar.");
  }

  const result = await deleteGroupMember(groupId, targetUserId);
  if (result.rowCount === 0) throw new GroupError(404, "Membro nao encontrado no grupo");

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Membro removido com sucesso.",
  };
}

export async function getGroupsByUserId(userId: string) {
  if (!userId.trim()) throw new GroupError(400, "userId e obrigatorio");

  const result = await findGroupsByUserId(userId);

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Grupos encontrados.",
    data: result.rows.map((row) => ({
      ...mapGroup(row),
      joinedAt: row.joined_at,
    })),
  };
}

export async function deleteGroup(groupId: string, requesterUserId: string) {
  if (!groupId.trim()) throw new GroupError(400, "groupId e obrigatorio");

  const groupResult = await findGroupOwner(groupId);
  const group = groupResult.rows[0];
  if (!group) throw new GroupError(404, "Grupo nao encontrado");
  if (group.owner_id !== requesterUserId) {
    throw new GroupError(403, "Apenas o owner pode deletar o grupo");
  }

  await softDeleteGroup(groupId);

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Grupo deletado com sucesso.",
  };
}
