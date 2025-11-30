// Drizzle database connection
// Uses Neon Postgres with postgres-js driver
// Singleton pattern for serverless environments

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Singleton pattern for postgres client (prevents multiple connections in serverless)
declare global {
  // eslint-disable-next-line no-var
  var postgresClient: postgres.Sql | undefined;
}

// Create postgres client with singleton pattern
const client =
  globalThis.postgresClient ??
  postgres(process.env.DATABASE_URL, {
    max: 1, // Limit connections for serverless
    ssl: "require",
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.postgresClient = client;
}

// Create Drizzle instance
export const db = drizzle(client, { schema });

// Export schema for use in other files
export * from "./schema";
