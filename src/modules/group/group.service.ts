import { z as zod } from "zod";
import { query, withDatabaseTransaction } from "../../config/database.js";

const createGroupSchema = zod.object({
  name: zod.string().trim().min(1, "Nome do grupo e obrigatorio").max(150),
  description: zod.string().trim().max(500).optional(),
});

const addMemberSchema = zod.object({
  userId: zod.string().trim().min(1, "userId e obrigatorio"),
});

type GroupRow = {
  group_id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_username: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
};

type GroupListRow = GroupRow & { joined_at: string };

type MemberRow = {
  user_id: string;
  username: string;
  name: string;
  joined_at: string;
};

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
    const groupResult = await client.query<{
      group_id: string;
      name: string;
      description: string | null;
      owner_id: string;
      created_at: string;
      updated_at: string;
    }>(
      `
        INSERT INTO groups (name, description, owner_id)
        VALUES ($1, $2, $3)
        RETURNING group_id, name, description, owner_id, created_at, updated_at
      `,
      [name, description ?? null, ownerUserId],
    );

    const groupRow = groupResult.rows[0];
    if (!groupRow) throw new GroupError(500, "Falha ao criar grupo");

    await client.query(`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)`, [
      groupRow.group_id,
      ownerUserId,
    ]);

    const ownerResult = await client.query<{ username: string; name: string }>(
      `SELECT username, name FROM users WHERE user_id = $1`,
      [ownerUserId],
    );

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

  const groupResult = await query<GroupRow>(
    `
      SELECT g.group_id, g.name, g.description, g.owner_id, g.created_at, g.updated_at,
             u.username AS owner_username, u.name AS owner_name
      FROM groups g
      JOIN users u ON u.user_id = g.owner_id
      WHERE g.group_id = $1 AND g.deleted_at IS NULL
    `,
    [groupId.trim()],
  );

  const groupRow = groupResult.rows[0];

  if (!groupRow) return null;

  const membersResult = await query<MemberRow>(
    `
      SELECT gm.user_id, gm.joined_at, u.username, u.name
      FROM group_members gm
      JOIN users u ON u.user_id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY gm.joined_at ASC
    `,
    [groupId.trim()],
  );

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

  const groupResult = await query<{ owner_id: string }>(
    `SELECT owner_id FROM groups WHERE group_id = $1 AND deleted_at IS NULL`,
    [groupId.trim()],
  );

  const group = groupResult.rows[0];
  if (!group) throw new GroupError(404, "Grupo nao encontrado");

  if (group.owner_id !== requesterUserId) {
    throw new GroupError(403, "Apenas o owner pode adicionar membros");
  }

  await query(`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
    groupId.trim(),
    userId,
  ]);

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

  const groupResult = await query<{ owner_id: string }>(
    `SELECT owner_id FROM groups WHERE group_id = $1 AND deleted_at IS NULL`,
    [groupId.trim()],
  );

  const group = groupResult.rows[0];
  if (!group) throw new GroupError(404, "Grupo nao encontrado");

  const isOwner = group.owner_id === requesterUserId;
  const isSelf = targetUserId === requesterUserId;

  if (!isOwner && !isSelf) {
    throw new GroupError(403, "Sem permissao para remover este membro");
  }

  if (isOwner && isSelf) {
    throw new GroupError(400, "O owner nao pode sair do grupo. Delete o grupo para encerrar.");
  }

  const result = await query(
    `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId.trim(), targetUserId.trim()],
  );

  if (result.rowCount === 0) {
    throw new GroupError(404, "Membro nao encontrado no grupo");
  }

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Membro removido com sucesso.",
  };
}

export async function getGroupsByUserId(userId: string) {
  if (!userId.trim()) throw new GroupError(400, "userId e obrigatorio");

  const result = await query<GroupListRow>(
    `
      SELECT g.group_id, g.name, g.description, g.owner_id, g.created_at, g.updated_at,
             u.username AS owner_username, u.name AS owner_name,
             gm.joined_at
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.group_id
      JOIN users u ON u.user_id = g.owner_id
      WHERE gm.user_id = $1 AND g.deleted_at IS NULL
      ORDER BY gm.joined_at DESC
    `,
    [userId.trim()],
  );

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

  const groupResult = await query<{ owner_id: string }>(
    `SELECT owner_id FROM groups WHERE group_id = $1 AND deleted_at IS NULL`,
    [groupId.trim()],
  );

  const group = groupResult.rows[0];
  if (!group) throw new GroupError(404, "Grupo nao encontrado");

  if (group.owner_id !== requesterUserId) {
    throw new GroupError(403, "Apenas o owner pode deletar o grupo");
  }

  await query(
    `UPDATE groups SET deleted_at = now(), updated_at = now() WHERE group_id = $1`,
    [groupId.trim()],
  );

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Grupo deletado com sucesso.",
  };
}
