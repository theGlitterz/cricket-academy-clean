/**
 * Seed script — run once to populate default services and facility settings.
 * Usage: npx tsx server/seed.ts
 */
import { getDb } from "./db";
import { facilities, services, slots, bookings, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const DEFAULT_SERVICES = [
  {
    facilityId: 1,
    slug: "ground-booking",
    name: "Ground Booking",
    description:
      "Book the full cricket ground for your team practice, match simulation, or training camp. Includes pitch and outfield.",
    price: "1500.00",
    durationMinutes: 120,
    activeStatus: true,
    sortOrder: 1,
  },
  {
    facilityId: 1,
    slug: "net-practice",
    name: "Net Practice",
    description:
      "Reserve a dedicated net lane for focused batting or bowling drills. Ideal for individual or small group training.",
    price: "500.00",
    durationMinutes: 60,
    activeStatus: true,
    sortOrder: 2,
  },
  {
    facilityId: 1,
    slug: "personal-coaching",
    name: "Personal Coaching",
    description:
      "One-on-one coaching session with our certified coach. Tailored feedback on technique, fitness, and game strategy.",
    price: "800.00",
    durationMinutes: 60,
    activeStatus: true,
    sortOrder: 3,
  },
];

// Generate sample slots for the next 7 days
function generateSampleSlots(serviceId: number, facilityId: number) {
  const sampleSlots = [];
  const today = new Date();
  const timeSlots = [
    { start: "06:00", end: "07:00" },
    { start: "07:00", end: "08:00" },
    { start: "08:00", end: "09:00" },
    { start: "09:00", end: "10:00" },
    { start: "16:00", end: "17:00" },
    { start: "17:00", end: "18:00" },
    { start: "18:00", end: "19:00" },
    { start: "19:00", end: "20:00" },
    { start: "20:00", end: "21:00" },
  ];

  for (let d = 0; d < 14; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

    for (const slot of timeSlots) {
      sampleSlots.push({
        facilityId,
        serviceId,
        date: dateStr,
        startTime: slot.start,
        endTime: slot.end,
        availabilityStatus: "available" as const,
      });
    }
  }
  return sampleSlots;
}

async function seed() {
  console.log("🌱 Seeding database...");
  const db = await getDb();
  if (!db) {
    console.error("❌ Database not available. Check DATABASE_URL.");
    process.exit(1);
  }

  // ── 1. Seed facility ──────────────────────────────────────────────────────
  const existingFacility = await db.select().from(facilities).limit(1);
  let facilityId = 1;

  if (existingFacility.length === 0) {
    const [inserted] = await db.insert(facilities).values({
      facilityName: "BestCricketAcademy",
      coachName: "Coach Ravi Kumar",
      coachWhatsApp: "+919876543210",
      upiId: "bestcricket@upi",
      upiQrImageUrl: null,
      address: "Cricket Ground, Sector 12, Bengaluru, Karnataka 560001",
      workingHours: "6:00 AM – 9:00 PM",
      paymentInstructions:
        "Pay the exact amount via UPI and upload the payment screenshot to confirm your booking.",
      googleMapsUrl: null,
      isActive: true,
    }).returning({ id: facilities.id });
    facilityId = inserted.id;
    console.log("✅ Created facility: BestCricketAcademy");
  } else {
    facilityId = existingFacility[0].id;
    console.log(`⏭️  Facility already exists (id=${facilityId})`);
  }

  // ── 2. Seed services ──────────────────────────────────────────────────────
  const createdServiceIds: Record<string, number> = {};

  for (const service of DEFAULT_SERVICES) {
    const existing = await db
      .select()
      .from(services)
      .where(eq(services.slug, service.slug))
      .limit(1);

    if (existing.length === 0) {
      const [inserted] = await db.insert(services).values({
        ...service,
        facilityId,
      }).returning({ id: services.id });
      const newId = inserted.id;
      createdServiceIds[service.slug] = newId;
      console.log(`✅ Created service: ${service.name} (id=${newId})`);
    } else {
      createdServiceIds[service.slug] = existing[0].id;
      console.log(`⏭️  Service already exists: ${service.name} (id=${existing[0].id})`);
    }
  }

  // ── 3. Seed slots (only if none exist) ───────────────────────────────────
  const existingSlots = await db.select().from(slots).limit(1);
  if (existingSlots.length === 0) {
    for (const [slug, serviceId] of Object.entries(createdServiceIds)) {
      const slotData = generateSampleSlots(serviceId, facilityId);
      // Insert in batches of 50
      for (let i = 0; i < slotData.length; i += 50) {
        await db.insert(slots).values(slotData.slice(i, i + 50));
      }
      console.log(`✅ Created ${slotData.length} slots for ${slug}`);
    }
  } else {
    console.log("⏭️  Slots already exist, skipping slot seed");
  }

  // ── 4. Seed sample bookings (demo data) ──────────────────────────────────
  const existingBookings = await db.select().from(bookings).limit(1);
  if (existingBookings.length === 0) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Get a real slot to attach demo bookings to
    const availableSlot = await db
      .select()
      .from(slots)
      .where(eq(slots.availabilityStatus, "available"))
      .limit(3);

    if (availableSlot.length >= 1) {
      const demoBookings = [
        {
          facilityId,
          serviceId: availableSlot[0].serviceId,
          slotId: availableSlot[0].id,
          referenceId: `BCA-DEMO-001`,
          playerName: "Arjun Sharma",
          playerWhatsApp: "+919876543001",
          bookingDate: availableSlot[0].date,
          startTime: availableSlot[0].startTime,
          endTime: availableSlot[0].endTime,
          amount: "1500.00",
          paymentStatus: "pending_review" as const,
          bookingStatus: "pending" as const,
          adminNote: null,
          screenshotUrl: null,
        },
      ];

      if (availableSlot.length >= 2) {
        await db.insert(bookings).values({
          facilityId,
          serviceId: availableSlot[1].serviceId,
          slotId: availableSlot[1].id,
          referenceId: `BCA-DEMO-002`,
          playerName: "Priya Patel",
          playerWhatsApp: "+919876543002",
          bookingDate: availableSlot[1].date,
          startTime: availableSlot[1].startTime,
          endTime: availableSlot[1].endTime,
          amount: "500.00",
          paymentStatus: "confirmed",
          bookingStatus: "confirmed",
          adminNote: null,
          screenshotUrl: null,
        });
        await db
          .update(slots)
          .set({ availabilityStatus: "booked" })
          .where(eq(slots.id, availableSlot[1].id));
        console.log("✅ Created demo booking: Priya Patel (confirmed)");
      }

      for (const booking of demoBookings) {
        await db.insert(bookings).values(booking);
        // Mark the slot as booked
        await db
          .update(slots)
          .set({ availabilityStatus: "booked" })
          .where(eq(slots.id, booking.slotId));
      }
      console.log(`✅ Created ${demoBookings.length} demo bookings`);
    } else {
      console.log("⚠️  No available slots found for demo bookings");
    }
  } else {
    console.log("⏭️  Bookings already exist, skipping demo booking seed");
  }

  // ── 5. Seed admin user ────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn(
      "⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin user seed.\n" +
      "   Set both env vars and re-run to create the super_admin account."
    );
  } else {
    const existingAdmin = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log(`⏭️  Admin user already exists: ${adminEmail}`);
    } else {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await db.insert(users).values({
        email: adminEmail,
        passwordHash,
        name: "Super Admin",
        role: "admin",
        facilityId: null,
      });
      console.log(`✅ Created super_admin user: ${adminEmail}`);
    }
  }

  console.log("🎉 Seed complete!");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
