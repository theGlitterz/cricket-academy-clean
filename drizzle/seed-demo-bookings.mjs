/**
 * Seed script: add rejected and cancelled demo bookings for all 4 status types.
 * Run with: node drizzle/seed-demo-bookings.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Check existing bookings
  const [existing] = await conn.query(
    "SELECT referenceId, bookingStatus, playerName FROM bookings ORDER BY id"
  );
  console.log("Existing bookings:", existing);

  // Check if rejected/cancelled already exist
  const statuses = existing.map((b) => b.bookingStatus);
  if (statuses.includes("rejected") && statuses.includes("cancelled")) {
    console.log("Rejected and cancelled bookings already exist. Skipping.");
    await conn.end();
    process.exit(0);
  }

  // Insert rejected demo booking (slot 3 stays available — rejection frees slot)
  if (!statuses.includes("rejected")) {
    await conn.query(
      `INSERT INTO bookings 
        (referenceId, facilityId, serviceId, slotId, playerName, playerWhatsApp, bookingDate, startTime, endTime, amount, bookingStatus, paymentStatus, adminNote, createdAt, updatedAt)
        VALUES (?, 1, 1, 3, ?, ?, '2026-04-10', '08:00', '09:00', '800.00', 'rejected', 'rejected', 'Payment screenshot was blurry. Please resubmit with a clearer image.', NOW(), NOW())`,
      ["BCA-DEMO-REJECTED", "Vikram Singh", "+919988776655"]
    );
    console.log("✓ Inserted rejected demo booking (Vikram Singh)");
  }

  // Insert cancelled demo booking (was confirmed, then cancelled)
  if (!statuses.includes("cancelled")) {
    await conn.query(
      `INSERT INTO bookings 
        (referenceId, facilityId, serviceId, slotId, playerName, playerWhatsApp, bookingDate, startTime, endTime, amount, bookingStatus, paymentStatus, adminNote, createdAt, updatedAt)
        VALUES (?, 1, 2, 4, ?, ?, '2026-04-10', '09:00', '10:00', '500.00', 'cancelled', 'confirmed', 'Player requested cancellation due to travel plans.', NOW(), NOW())`,
      ["BCA-DEMO-CANCELLED", "Meera Reddy", "+918877665544"]
    );
    console.log("✓ Inserted cancelled demo booking (Meera Reddy)");
  }

  // Verify all 4 statuses now exist
  const [final] = await conn.query(
    "SELECT referenceId, bookingStatus, paymentStatus, playerName FROM bookings ORDER BY id"
  );
  console.log("\nFinal bookings:");
  for (const b of final) {
    console.log(`  [${b.bookingStatus}/${b.paymentStatus}] ${b.playerName} — ${b.referenceId}`);
  }

  const finalStatuses = new Set(final.map((b) => b.bookingStatus));
  const required = ["pending", "confirmed", "rejected", "cancelled"];
  const missing = required.filter((s) => !finalStatuses.has(s));
  if (missing.length === 0) {
    console.log("\n✓ All 4 booking statuses present in demo data.");
  } else {
    console.warn("\n⚠ Missing statuses:", missing);
  }
} finally {
  await conn.end();
}
