import bcrypt from "bcrypt";
import { query, closeDatabase } from "../src/config/database.js";

const SALT_ROUNDS = 10;

// Porto Alegre / PUCRS area as base coordinates
const users = [
  {
    username: "alice",
    name: "Alice Silva",
    email: "alice@safetravels.dev",
    password: "senha123",
  },
  {
    username: "bob",
    name: "Bob Santos",
    email: "bob@safetravels.dev",
    password: "senha123",
  },
  {
    username: "carol",
    name: "Carol Oliveira",
    email: "carol@safetravels.dev",
    password: "senha123",
  },
  {
    username: "dave",
    name: "Dave Ferreira",
    email: "dave@safetravels.dev",
    password: "senha123",
  },
];

type LocationSeed = {
  username: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
};

const locationSeeds: LocationSeed[] = [
  // alice — caminhando pelo campus PUCRS
  {
    username: "alice",
    latitude: -30.0561,
    longitude: -51.1761,
    accuracyMeters: 5,
    capturedAt: "2026-04-19T08:00:00Z",
  },
  {
    username: "alice",
    latitude: -30.0567,
    longitude: -51.1769,
    accuracyMeters: 6,
    capturedAt: "2026-04-19T08:05:00Z",
  },
  {
    username: "alice",
    latitude: -30.0574,
    longitude: -51.1778,
    accuracyMeters: 4,
    capturedAt: "2026-04-19T08:10:00Z",
  },

  // bob — Parque Farroupilha
  {
    username: "bob",
    latitude: -30.0378,
    longitude: -51.2144,
    accuracyMeters: 8,
    capturedAt: "2026-04-19T09:00:00Z",
  },
  {
    username: "bob",
    latitude: -30.0385,
    longitude: -51.2151,
    accuracyMeters: 10,
    capturedAt: "2026-04-19T09:07:00Z",
  },
  {
    username: "bob",
    latitude: -30.039,
    longitude: -51.216,
    accuracyMeters: 7,
    capturedAt: "2026-04-19T09:15:00Z",
  },

  // carol — Centro Histórico de Porto Alegre
  {
    username: "carol",
    latitude: -30.0277,
    longitude: -51.2287,
    accuracyMeters: 12,
    capturedAt: "2026-04-19T10:00:00Z",
  },
  {
    username: "carol",
    latitude: -30.0281,
    longitude: -51.2295,
    accuracyMeters: 9,
    capturedAt: "2026-04-19T10:08:00Z",
  },
  {
    username: "carol",
    latitude: -30.0286,
    longitude: -51.2302,
    accuracyMeters: 11,
    capturedAt: "2026-04-19T10:16:00Z",
  },
  {
    username: "carol",
    latitude: -30.029,
    longitude: -51.231,
    accuracyMeters: 8,
    capturedAt: "2026-04-19T10:24:00Z",
  },

  // dave — Aeroporto Salgado Filho
  {
    username: "dave",
    latitude: -29.9939,
    longitude: -51.1714,
    accuracyMeters: 15,
    capturedAt: "2026-04-19T06:30:00Z",
  },
  {
    username: "dave",
    latitude: -29.9945,
    longitude: -51.172,
    accuracyMeters: 12,
    capturedAt: "2026-04-19T06:45:00Z",
  },
];

async function seed() {
  console.log("Seeding database...\n");

  // Insert users
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

  // Insert location events
  console.log("\nCreating location events...");

  for (const loc of locationSeeds) {
    const userId = userIdByUsername.get(loc.username);
    if (!userId) throw new Error(`No userId found for username ${loc.username}`);

    await query(
      `
        INSERT INTO location_events (user_id, latitude, longitude, accuracy_meters, captured_at)
        VALUES ($1, $2, $3, $4, $5::timestamptz)
      `,
      [userId, loc.latitude, loc.longitude, loc.accuracyMeters, loc.capturedAt],
    );

    console.log(`  ${loc.username} @ (${loc.latitude}, ${loc.longitude}) — ${loc.capturedAt}`);
  }

  console.log("\nDone.");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closeDatabase());
