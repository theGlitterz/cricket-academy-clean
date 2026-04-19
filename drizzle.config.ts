import { defineConfig } from "drizzle-kit";

// For migrations, prefer the direct (non-pooled) connection string.
// Set DATABASE_URL_UNPOOLED in your environment when running drizzle-kit commands.
// In production at runtime, use the pooled DATABASE_URL.
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL or DATABASE_URL_UNPOOLED is required to run drizzle commands"
  );
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
