import bcrypt from "bcrypt";
import { query, closeDatabase } from "../src/config/database.js";

const SALT_ROUNDS = 10;

const users = [
  { username: "root",  name: "root",           email: "root@root.com",          password: "rootroot" },
  { username: "alice", name: "Alice Silva",     email: "alice@safetravels.dev",  password: "senha123" },
  { username: "bob",   name: "Bob Santos",      email: "bob@safetravels.dev",    password: "senha123" },
  { username: "carol", name: "Carol Oliveira",  email: "carol@safetravels.dev",  password: "senha123" },
  { username: "dave",  name: "Dave Ferreira",   email: "dave@safetravels.dev",   password: "senha123" },
];

type GroupSeed = {
  slug: string;
  name: string;
  description: string;
  owner: string;
  members: string[];
};

const groups: GroupSeed[] = [
  {
    slug: "viagem_pucrs",
    name: "Viagem PUCRS 2026",
    description: "Grupo da galera da PUCRS para a viagem de formatura.",
    owner: "alice",
    members: ["alice", "bob", "carol", "root"],
  },
  {
    slug: "exploracao_poa",
    name: "Exploração Porto Alegre",
    description: "Descobrindo os cantinhos de POA.",
    owner: "bob",
    members: ["bob", "dave"],
  },
];

type LocationSeed = {
  username: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
};

// Eventos vinculados a grupos — aparecem em GET /group/:groupId/location
const locationSeeds: LocationSeed[] = [
  // alice — campus PUCRS (viagem_pucrs)
  { username: "alice", latitude: -30.0561, longitude: -51.1761, accuracyMeters: 5,  capturedAt: "2026-04-19T08:00:00Z" },
  { username: "alice", latitude: -30.0567, longitude: -51.1769, accuracyMeters: 6,  capturedAt: "2026-04-19T08:05:00Z" },
  { username: "alice", latitude: -30.0574, longitude: -51.1778, accuracyMeters: 4,  capturedAt: "2026-04-19T08:10:00Z" },

  // bob — Parque Farroupilha (viagem_pucrs + exploracao_poa)
  { username: "bob",   latitude: -30.0378, longitude: -51.2144, accuracyMeters: 8,  capturedAt: "2026-04-19T09:00:00Z" },
  { username: "bob",   latitude: -30.0385, longitude: -51.2151, accuracyMeters: 10, capturedAt: "2026-04-19T09:07:00Z" },
  { username: "bob",   latitude: -30.0390, longitude: -51.2160, accuracyMeters: 7,  capturedAt: "2026-04-19T09:15:00Z" },

  // carol — Centro Histórico (viagem_pucrs)
  { username: "carol", latitude: -30.0277, longitude: -51.2287, accuracyMeters: 12, capturedAt: "2026-04-19T10:00:00Z" },
  { username: "carol", latitude: -30.0281, longitude: -51.2295, accuracyMeters: 9,  capturedAt: "2026-04-19T10:08:00Z" },
  { username: "carol", latitude: -30.0286, longitude: -51.2302, accuracyMeters: 11, capturedAt: "2026-04-19T10:16:00Z" },
  { username: "carol", latitude: -30.0290, longitude: -51.2310, accuracyMeters: 8,  capturedAt: "2026-04-19T10:24:00Z" },

  // dave — Aeroporto Salgado Filho (exploracao_poa)
  { username: "dave",  latitude: -29.9939, longitude: -51.1714, accuracyMeters: 15, capturedAt: "2026-04-19T06:30:00Z" },
  { username: "dave",  latitude: -29.9945, longitude: -51.1720, accuracyMeters: 12, capturedAt: "2026-04-19T06:45:00Z" },
];

// Eventos pessoais mais recentes — SEM vínculo de grupo.
// Aparecem em GET /location/user/:userId mas NÃO em GET /group/:groupId/location,
// garantindo que os dois endpoints retornem dados distintos.
const personalLocationSeeds: LocationSeed[] = [
  // alice — saiu do campus, foi ao Shopping Iguatemi (1h depois)
  { username: "alice", latitude: -30.0232, longitude: -51.1580, accuracyMeters: 6,  capturedAt: "2026-04-19T09:10:00Z" },

  // bob — saiu do Farroupilha, foi ao Mercado Público (1h depois)
  { username: "bob",   latitude: -30.0279, longitude: -51.2292, accuracyMeters: 8,  capturedAt: "2026-04-19T10:20:00Z" },

  // carol — saiu do Centro, foi à Usina do Gasômetro (30min depois)
  { username: "carol", latitude: -30.0326, longitude: -51.2376, accuracyMeters: 10, capturedAt: "2026-04-19T10:55:00Z" },

  // dave — saiu do aeroporto, foi ao bairro Moinhos de Vento (2h depois)
  { username: "dave",  latitude: -30.0197, longitude: -51.1993, accuracyMeters: 9,  capturedAt: "2026-04-19T08:50:00Z" },
];

async function seed() {
  console.log("Seeding database...\n");

  // ── Users ──────────────────────────────────────────────────────────────────
  console.log("Creating users...");
  const userIdByUsername = new Map<string, string>();

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

    const result = await query<{ user_id: string }>(
      `
        INSERT INTO users (username, name, email, password_hash)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
        RETURNING user_id
      `,
      [user.username, user.name, user.email, passwordHash],
    );

    const userId = result.rows[0]?.user_id;
    if (!userId) throw new Error(`Failed to insert user ${user.username}`);

    userIdByUsername.set(user.username, userId);
    console.log(`  ${user.username} → ${userId}`);
  }

  // ── Groups + members ───────────────────────────────────────────────────────
  console.log("\nCreating groups...");
  const groupIdBySlug = new Map<string, string>();

  for (const group of groups) {
    const ownerId = userIdByUsername.get(group.owner);
    if (!ownerId) throw new Error(`No userId for owner ${group.owner}`);

    const result = await query<{ group_id: string }>(
      `
        INSERT INTO groups (name, description, owner_id)
        VALUES ($1, $2, $3)
        RETURNING group_id
      `,
      [group.name, group.description, ownerId],
    );

    const groupId = result.rows[0]?.group_id;
    if (!groupId) throw new Error(`Failed to insert group ${group.slug}`);

    groupIdBySlug.set(group.slug, groupId);
    console.log(`  "${group.name}" → ${groupId}`);

    console.log(`    members:`);
    for (const username of group.members) {
      const userId = userIdByUsername.get(username);
      if (!userId) throw new Error(`No userId for member ${username}`);

      await query(
        `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [groupId, userId],
      );
      console.log(`      ${username}`);
    }
  }

  // Build user → [groupIds] map for location linking
  const groupIdsByUsername = new Map<string, string[]>();
  for (const group of groups) {
    const groupId = groupIdBySlug.get(group.slug)!;
    for (const username of group.members) {
      const existing = groupIdsByUsername.get(username) ?? [];
      existing.push(groupId);
      groupIdsByUsername.set(username, existing);
    }
  }

  // ── Location events + group links ──────────────────────────────────────────
  console.log("\nCreating location events...");

  for (const loc of locationSeeds) {
    const userId = userIdByUsername.get(loc.username);
    if (!userId) throw new Error(`No userId for username ${loc.username}`);

    const result = await query<{ location_event_id: number }>(
      `
        INSERT INTO location_events (user_id, latitude, longitude, accuracy_meters, captured_at)
        VALUES ($1, $2, $3, $4, $5::timestamptz)
        RETURNING location_event_id
      `,
      [userId, loc.latitude, loc.longitude, loc.accuracyMeters, loc.capturedAt],
    );

    const locationEventId = result.rows[0]?.location_event_id;
    if (!locationEventId) throw new Error(`Failed to insert location for ${loc.username}`);

    const groupIds = groupIdsByUsername.get(loc.username) ?? [];
    if (groupIds.length > 0) {
      await query(
        `
          INSERT INTO location_event_groups (location_event_id, group_id)
          SELECT $1, unnest($2::varchar[])
        `,
        [locationEventId, groupIds],
      );
    }

    const groupLabels = groupIds.length > 0
      ? groups.filter((g) => groupIds.includes(groupIdBySlug.get(g.slug)!)).map((g) => g.slug).join(", ")
      : "sem grupo";

    console.log(`  ${loc.username} @ (${loc.latitude}, ${loc.longitude}) [${groupLabels}]`);
  }

  // ── Personal-only location events (sem vínculo de grupo) ──────────────────
  console.log("\nCreating personal location events (no group link)...");

  for (const loc of personalLocationSeeds) {
    const userId = userIdByUsername.get(loc.username);
    if (!userId) throw new Error(`No userId for username ${loc.username}`);

    await query(
      `
        INSERT INTO location_events (user_id, latitude, longitude, accuracy_meters, captured_at)
        VALUES ($1, $2, $3, $4, $5::timestamptz)
      `,
      [userId, loc.latitude, loc.longitude, loc.accuracyMeters, loc.capturedAt],
    );

    console.log(`  ${loc.username} @ (${loc.latitude}, ${loc.longitude}) [pessoal]`);
  }

  console.log("\nDone.");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closeDatabase());
