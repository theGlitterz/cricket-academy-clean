/**
 * Prompt 2 migration — applies each DDL/DML statement individually
 * so MySQL doesn't reject multi-column ALTER TABLE syntax.
 * Run: node drizzle/migrate-prompt2.mjs
 */
import mysql from "mysql2/promise";

const STATEMENTS = [
  // ── facilities table ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS \`facilities\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`facilityName\` varchar(128) NOT NULL,
    \`coachName\` varchar(128),
    \`coachWhatsApp\` varchar(20),
    \`upiId\` varchar(128),
    \`upiQrImageUrl\` text,
    \`address\` text,
    \`workingHours\` varchar(64),
    \`paymentInstructions\` text,
    \`googleMapsUrl\` text,
    \`isActive\` boolean NOT NULL DEFAULT true,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`facilities_id\` PRIMARY KEY(\`id\`)
  )`,

  // ── services: add facilityId ────────────────────────────────────────────────
  `ALTER TABLE \`services\` ADD COLUMN \`facilityId\` int NOT NULL DEFAULT 1 AFTER \`id\``,
  // ── services: add price ─────────────────────────────────────────────────────
  `ALTER TABLE \`services\` ADD COLUMN \`price\` decimal(10,2) NOT NULL DEFAULT 0`,
  // ── services: add activeStatus ──────────────────────────────────────────────
  `ALTER TABLE \`services\` ADD COLUMN \`activeStatus\` boolean NOT NULL DEFAULT true`,
  // ── services: backfill price and activeStatus ───────────────────────────────
  `UPDATE \`services\` SET \`price\` = \`pricePerSlot\`, \`activeStatus\` = \`isActive\``,

  // ── slots: add facilityId (may already exist from prior run) ────────────────
  `ALTER TABLE \`slots\` ADD COLUMN \`facilityId\` int NOT NULL DEFAULT 1 AFTER \`id\``,
  // ── slots: add availabilityStatus ───────────────────────────────────────────
  `ALTER TABLE \`slots\` ADD COLUMN \`availabilityStatus\` enum('available','booked','blocked') NOT NULL DEFAULT 'available'`,
  // ── slots: backfill availabilityStatus ──────────────────────────────────────
  `UPDATE \`slots\` SET \`availabilityStatus\` = CASE WHEN \`isBlocked\` = true THEN 'blocked' WHEN \`bookedCount\` > 0 THEN 'booked' ELSE 'available' END`,

  // ── bookings: add facilityId ────────────────────────────────────────────────
  `ALTER TABLE \`bookings\` ADD COLUMN \`facilityId\` int NOT NULL DEFAULT 1 AFTER \`id\``,
  // ── bookings: add bookingDate ────────────────────────────────────────────────
  `ALTER TABLE \`bookings\` ADD COLUMN \`bookingDate\` varchar(10) NOT NULL DEFAULT ''`,
  // ── bookings: add startTime ──────────────────────────────────────────────────
  `ALTER TABLE \`bookings\` ADD COLUMN \`startTime\` varchar(5) NOT NULL DEFAULT ''`,
  // ── bookings: add endTime ────────────────────────────────────────────────────
  `ALTER TABLE \`bookings\` ADD COLUMN \`endTime\` varchar(5) NOT NULL DEFAULT ''`,
  // ── bookings: add amount ─────────────────────────────────────────────────────
  `ALTER TABLE \`bookings\` ADD COLUMN \`amount\` decimal(10,2) NOT NULL DEFAULT 0`,
  // ── bookings: add screenshotUrl ──────────────────────────────────────────────
  `ALTER TABLE \`bookings\` ADD COLUMN \`screenshotUrl\` text`,
  // ── bookings: add paymentStatus ──────────────────────────────────────────────
  `ALTER TABLE \`bookings\` ADD COLUMN \`paymentStatus\` enum('pending_review','confirmed','rejected') NOT NULL DEFAULT 'pending_review'`,
  // ── bookings: add bookingStatus ──────────────────────────────────────────────
  `ALTER TABLE \`bookings\` ADD COLUMN \`bookingStatus\` enum('pending','confirmed','rejected','cancelled') NOT NULL DEFAULT 'pending'`,

  // ── bookings: backfill denormalized slot fields ──────────────────────────────
  `UPDATE \`bookings\` b JOIN \`slots\` s ON b.\`slotId\` = s.\`id\` SET b.\`bookingDate\` = s.\`date\`, b.\`startTime\` = s.\`startTime\`, b.\`endTime\` = s.\`endTime\``,
  // ── bookings: backfill amount from service price ─────────────────────────────
  `UPDATE \`bookings\` b JOIN \`services\` sv ON b.\`serviceId\` = sv.\`id\` SET b.\`amount\` = sv.\`price\` WHERE b.\`amount\` = 0`,
  // ── bookings: backfill bookingStatus and paymentStatus from old status ────────
  `UPDATE \`bookings\` SET \`bookingStatus\` = \`status\`, \`screenshotUrl\` = \`paymentScreenshotUrl\`, \`paymentStatus\` = CASE WHEN \`status\` = 'confirmed' THEN 'confirmed' WHEN \`status\` = 'rejected' THEN 'rejected' ELSE 'pending_review' END`,
];

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  let ok = 0, skipped = 0, failed = 0;

  for (const stmt of STATEMENTS) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 70);
    try {
      await conn.query(stmt);
      console.log(`✅ ${preview}`);
      ok++;
    } catch (e) {
      // Idempotent: skip "already exists" / "duplicate column" errors
      if (
        e.code === "ER_TABLE_EXISTS_ERROR" ||
        e.code === "ER_DUP_FIELDNAME" ||
        e.message.includes("Duplicate column") ||
        e.message.includes("already exists")
      ) {
        console.log(`⏭️  Already applied: ${preview}`);
        skipped++;
      } else {
        console.error(`❌ ${e.message.slice(0, 100)}`);
        console.error(`   SQL: ${preview}`);
        failed++;
      }
    }
  }

  await conn.end();
  console.log(`\n📊 Done — ✅ ${ok} applied, ⏭️  ${skipped} skipped, ❌ ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
