/**
 * Cleanup migration: drop legacy columns from the old schema
 * that are no longer in the Drizzle schema definition.
 * Run: node drizzle/cleanup-old-columns.mjs
 */
import mysql2 from "mysql2/promise";

const conn = await mysql2.createConnection(process.env.DATABASE_URL);

const steps = [
  // ── bookings: drop old columns ──────────────────────────────────────────
  // amountPaid was the old field; amount is the new one
  "ALTER TABLE `bookings` MODIFY COLUMN `amount` decimal(10,2) NOT NULL",
  // Drop old columns if they still exist
  "ALTER TABLE `bookings` DROP COLUMN IF EXISTS `amountPaid`",
  "ALTER TABLE `bookings` DROP COLUMN IF EXISTS `status`",
  "ALTER TABLE `bookings` DROP COLUMN IF EXISTS `paymentScreenshotUrl`",

  // ── services: drop old columns ──────────────────────────────────────────
  "ALTER TABLE `services` DROP COLUMN IF EXISTS `pricePerSlot`",
  "ALTER TABLE `services` DROP COLUMN IF EXISTS `maxCapacity`",
  "ALTER TABLE `services` DROP COLUMN IF EXISTS `isActive`",

  // ── slots: drop old columns ─────────────────────────────────────────────
  "ALTER TABLE `slots` DROP COLUMN IF EXISTS `isBlocked`",
  "ALTER TABLE `slots` DROP COLUMN IF EXISTS `capacity`",
  "ALTER TABLE `slots` DROP COLUMN IF EXISTS `bookedCount`",
];

let applied = 0;
let failed = 0;

for (const sql of steps) {
  try {
    await conn.query(sql);
    console.log(`✅ ${sql.slice(0, 80)}`);
    applied++;
  } catch (err) {
    if (err.code === "ER_CANT_DROP_FIELD_OR_KEY" || err.code === "ER_BAD_FIELD_ERROR") {
      console.log(`⏭️  Column already absent: ${sql.slice(0, 80)}`);
    } else {
      console.error(`❌ FAILED: ${sql.slice(0, 80)}`);
      console.error(`   ${err.message}`);
      failed++;
    }
  }
}

console.log(`\n📊 Done — ✅ ${applied} applied, ❌ ${failed} failed`);
await conn.end();
process.exit(failed > 0 ? 1 : 0);
