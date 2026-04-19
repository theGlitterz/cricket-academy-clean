import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigration(sqlFile) {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const raw = readFileSync(join(__dirname, sqlFile), "utf8");

  // Split on drizzle's statement-breakpoint marker OR semicolons
  const statements = raw
    .split(/--> statement-breakpoint/)
    .flatMap((chunk) => chunk.split(/;\s*\n/))
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter((s) => s.length > 0);

  let ok = 0;
  let err = 0;

  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      console.log(`✅ ${stmt.slice(0, 80).replace(/\s+/g, " ")}`);
      ok++;
    } catch (e) {
      // Ignore "already exists" and "duplicate column" errors — idempotent
      if (
        e.code === "ER_TABLE_EXISTS_ERROR" ||
        e.code === "ER_DUP_FIELDNAME" ||
        e.message.includes("Duplicate column") ||
        e.message.includes("already exists")
      ) {
        console.log(`⏭️  Already applied: ${stmt.slice(0, 60).replace(/\s+/g, " ")}`);
        ok++;
      } else {
        console.error(`❌ ${e.message.slice(0, 120)}`);
        console.error(`   SQL: ${stmt.slice(0, 80).replace(/\s+/g, " ")}`);
        err++;
      }
    }
  }

  await conn.end();
  console.log(`\n📊 Migration complete: ${ok} OK, ${err} errors`);
  if (err > 0) process.exit(1);
}

const file = process.argv[2] || "0002_prompt2_schema.sql";
runMigration(file).catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
