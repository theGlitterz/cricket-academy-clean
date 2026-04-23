/**
 * server/db.ts — All database query helpers for BestCricketAcademy.
 *
 * Design principles:
 * - All queries accept facilityId so the schema can support multiple
 *   facilities in the future. V1 always passes FACILITY_ID = 1.
 * - Helpers return raw Drizzle rows; routers handle transformation.
 * - Booking rules are enforced here (slot availability checks, status
 *   transitions) so they cannot be bypassed by any caller.
 */

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { nanoid } from "nanoid";
import {
  Booking,
  Facility,
  InsertBooking,
  InsertFacility,
  InsertService,
  InsertSlot,
  Service,
  Slot,
  bookings,
  facilities,
  services,
  slots,
  users,
  InsertUser,
} from "../drizzle/schema";

// ─── V1 constant: single facility ────────────────────────────────────────────
/**
 * FUTURE: Multi-facility support
 * Replace this constant with a dynamic lookup based on:
 *   - Authenticated user's facilityId (for multi-coach SaaS)
 *   - Subdomain (e.g. bestcricket.yourapp.com → facilityId=1)
 *   - URL parameter (e.g. /facility/1/book)
 * All DB helpers already accept facilityId as a parameter — only this
 * constant needs to change when expanding to multiple facilities.
 */
export const FACILITY_ID = 1;

// ─── DB singleton ─────────────────────────────────────────────────────────────

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

/** Create a new admin user with a pre-hashed password. */
export async function createUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(users).values(user);
}

/** Look up a user by email address. */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] ?? undefined;
}

/** Update lastSignedIn timestamp for a user. */
export async function touchUserSignIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

// ─── Facilities ───────────────────────────────────────────────────────────────

/** Get the single BestCricketAcademy facility record. */
export async function getFacility(): Promise<Facility | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, FACILITY_ID))
    .limit(1);
  return result[0] ?? undefined;
}

/** Upsert facility settings. Creates if not exists (id=1), updates otherwise. */
export async function upsertFacility(data: Partial<InsertFacility>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getFacility();
  if (!existing) {
    await db.insert(facilities).values({
      id: FACILITY_ID,
      facilityName: data.facilityName ?? "BestCricketAcademy",
      ...data,
    });
  } else {
    await db
      .update(facilities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(facilities.id, FACILITY_ID));
  }
}

// ─── Services ─────────────────────────────────────────────────────────────────

/** List all services with activeStatus=true for the facility. */
export async function getActiveServices(facilityId = FACILITY_ID): Promise<Service[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(services)
    .where(and(eq(services.facilityId, facilityId), eq(services.activeStatus, true)))
    .orderBy(services.sortOrder);
}

/** List all services (including inactive) — admin use. */
export async function getAllServices(facilityId = FACILITY_ID): Promise<Service[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(services)
    .where(eq(services.facilityId, facilityId))
    .orderBy(services.sortOrder);
}

/** Get a single service by slug. */
export async function getServiceBySlug(slug: string): Promise<Service | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(services)
    .where(and(eq(services.slug, slug), eq(services.facilityId, FACILITY_ID)))
    .limit(1);
  return result[0] ?? undefined;
}

/** Get a single service by id. */
export async function getServiceById(id: number): Promise<Service | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return result[0] ?? undefined;
}

/** Create or update a service. */
export async function upsertService(data: InsertService): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(services)
    .values(data)
    .onConflictDoUpdate({
      target: [services.facilityId, services.slug],
      set: {
        name: data.name,
        description: data.description,
        durationMinutes: data.durationMinutes,
        price: data.price,
        advanceAmount: data.advanceAmount,
        activeStatus: data.activeStatus,
        sortOrder: data.sortOrder,
        updatedAt: new Date(),
      },
    });
}


// ─── Slots ────────────────────────────────────────────────────────────────────

/**
 * Get available slots for a service on a specific date.
 * Returns only slots with availabilityStatus='available'.
 *
 * BOOKING RULE: A slot is only bookable when availabilityStatus='available'.
 */
export async function getAvailableSlots(
  serviceId: number,
  date: string,
  facilityId = FACILITY_ID
): Promise<Slot[]> {
  await expireStaleBookings(); 
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.facilityId, facilityId),
        eq(slots.serviceId, serviceId),
        eq(slots.date, date),
        eq(slots.availabilityStatus, "available")
      )
    )
    .orderBy(slots.startTime);
}

/**
 * Get all slots for a date range (admin view — shows all statuses).
 */
export async function getSlotsForDateRange(
  serviceId: number,
  fromDate: string,
  toDate: string,
  facilityId = FACILITY_ID
): Promise<Slot[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.facilityId, facilityId),
        eq(slots.serviceId, serviceId),
        gte(slots.date, fromDate),
        lte(slots.date, toDate)
      )
    )
    .orderBy(slots.date, slots.startTime);
}

/** Admin: get all slots for a specific date across all services. */
export async function getAllSlotsForDate(
  date: string,
  facilityId = FACILITY_ID
): Promise<Slot[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(slots)
    .where(and(eq(slots.facilityId, facilityId), eq(slots.date, date)))
    .orderBy(slots.serviceId, slots.startTime);
}

/** Admin: delete a slot by id (only if not booked). */
export async function deleteSlot(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const slot = await getSlotById(id);
  if (!slot) throw new Error("Slot not found");
  if (slot.availabilityStatus === "booked") throw new Error("Cannot delete a booked slot");
  await db.delete(slots).where(eq(slots.id, id));
}

/** Get a slot by id. */
export async function getSlotById(id: number): Promise<Slot | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(slots).where(eq(slots.id, id)).limit(1);
  return result[0] ?? undefined;
}

/** Create a new slot. Returns the new slot id. */
export async function createSlot(data: InsertSlot): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(slots).values({
    ...data,
    facilityId: data.facilityId ?? FACILITY_ID,
    availabilityStatus: "available",
  });
  const inserted = result as unknown as { id: number }[];
  return inserted[0]?.id ?? 0;
}

/**
 * Mark a slot as booked.
 * Called atomically during booking creation.
 *
 * BOOKING RULE: Only transitions available → booked.
 * Returns false if the slot is no longer available (race condition guard).
 */
export async function markSlotBooked(slotId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  // postgres-js driver returns updated rows only when .returning() is used.
  // We return the id of the updated row to confirm exactly one row was changed.
  const result = await db
    .update(slots)
    .set({ availabilityStatus: "booked", bookedCount: sql`${slots.bookedCount} + 1`, updatedAt: new Date() })
    .where(and(eq(slots.id, slotId), eq(slots.availabilityStatus, "available")))
    .returning({ id: slots.id });
  return result.length > 0;
}


/**
 * Revert a slot to available.
 * Called when a booking is rejected or cancelled.
 *
 * BOOKING RULE: Rejected/cancelled bookings free up the slot.
 */
export async function markSlotAvailable(slotId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(slots)
    .set({
      availabilityStatus: "available",
      bookedCount: sql`GREATEST(0, ${slots.bookedCount} - 1)`,
      updatedAt: new Date(),
    })
    .where(eq(slots.id, slotId));
}

/**
 * Admin: set a slot's blocked status.
 * Blocked slots cannot be booked even if capacity is available.
 */
export async function setSlotBlockStatus(slotId: number, blocked: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(slots)
    .set({ availabilityStatus: blocked ? "blocked" : "available" })
    .where(and(eq(slots.id, slotId), eq(slots.availabilityStatus, blocked ? "available" : "blocked")));
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

/** Generate a human-readable reference ID, e.g. BCA-20240409-A1B2 */
export function generateReferenceId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = nanoid(6).toUpperCase();
  return `BCA-${date}-${suffix}`;
}
/**
 * Release slots held by pending bookings with no screenshot uploaded
 * after more than 10 minutes. Called lazily before slot availability queries.
 */
export async function expireStaleBookings(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  // Find stale pending bookings: no screenshot, created > 10 min ago
  const stale = await db
    .select({ id: bookings.id, slotId: bookings.slotId })
    .from(bookings)
    .where(
      and(
        eq(bookings.bookingStatus, "pending"),
        eq(bookings.paymentStatus, "pending_review"),
        sql`${bookings.screenshotUrl} IS NULL`,
        sql`${bookings.createdAt} < ${tenMinutesAgo.toISOString()}`
      )
    );
  if (stale.length === 0) return;
  const staleIds = stale.map((b) => b.id);
  const staleSlotIds = stale.map((b) => b.slotId);
  // Cancel the stale bookings
  await db
    .update(bookings)
    .set({ bookingStatus: "cancelled", updatedAt: new Date() })
    .where(sql`${bookings.id} IN ${staleIds}`);
  // Release the slots back to available
  for (const slotId of staleSlotIds) {
    await markSlotAvailable(slotId);
  }
}

/**
 * Create a new booking.
 *
 * BOOKING RULES enforced here:
 * 1. Slot must exist and belong to the correct facility.
 * 2. Slot must be 'available' (markSlotBooked returns false if not).
 * 3. booking_status = 'pending', payment_status = 'pending_review'.
 * 4. Denormalized date/time copied from slot for easy querying.
 *
 * Returns { id, referenceId } on success.
 * Throws if slot is unavailable (double-booking prevention).
 */
export async function createBooking(data: {
  slotId: number;
  serviceId: number;
  playerName: string;
  playerWhatsApp: string;
  playerEmail?: string;
  facilityId?: number;
}): Promise<{ id: number; referenceId: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const slot = await getSlotById(data.slotId);
  if (!slot) throw new Error("Slot not found");
  if (slot.availabilityStatus !== "available") {
    throw new Error("This slot is no longer available. Please choose another time.");
  }

  const service = await getServiceById(data.serviceId);
  if (!service) throw new Error("Service not found");

  // Atomically mark slot as booked (race condition guard)
  const booked = await markSlotBooked(data.slotId);
  if (!booked) {
    throw new Error("This slot was just taken. Please choose another time.");
  }

  const referenceId = generateReferenceId();
  const facilityId = data.facilityId ?? FACILITY_ID;

  const result = await db.insert(bookings).values({
    referenceId,
    facilityId,
    serviceId: data.serviceId,
    slotId: data.slotId,
    playerName: data.playerName,
    playerWhatsApp: data.playerWhatsApp,
    playerEmail: data.playerEmail ?? null,
    bookingDate: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    amount: service.price,
    bookingStatus: "pending",
    paymentStatus: "pending_review",
  }).returning({ id: bookings.id });

  return { id: result[0].id, referenceId };
}

/** Get a booking by its numeric id. */
export async function getBookingById(id: number): Promise<Booking | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return result[0] ?? undefined;
}

/** Get a booking by reference ID (player-facing lookup). */
export async function getBookingByReference(referenceId: string): Promise<Booking | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(bookings)
    .where(eq(bookings.referenceId, referenceId))
    .limit(1);
  return result[0] ?? undefined;
}

/** Get all bookings for a player's WhatsApp number. */
export async function getBookingsByWhatsApp(
  playerWhatsApp: string,
  facilityId = FACILITY_ID
): Promise<Booking[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.facilityId, facilityId),
        eq(bookings.playerWhatsApp, playerWhatsApp)
      )
    )
    .orderBy(desc(bookings.createdAt));
}

/** Admin: list all bookings with optional status filter, joined with service name. */
export async function getAllBookings(
  facilityId = FACILITY_ID,
  statusFilter?: "pending" | "confirmed" | "rejected" | "cancelled",
  dateFilter?: string // YYYY-MM-DD
): Promise<(Booking & { serviceName: string | null })[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(bookings.facilityId, facilityId)];
  if (statusFilter) conditions.push(eq(bookings.bookingStatus, statusFilter));
  if (dateFilter) conditions.push(eq(bookings.bookingDate, dateFilter));
  const rows = await db
    .select({ booking: bookings, serviceName: services.name })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(and(...conditions))
    .orderBy(desc(bookings.createdAt));
  return rows.map((r) => ({ ...r.booking, serviceName: r.serviceName ?? null }));
}

/** Admin: get booking stats (counts by status). */
export async function getBookingStats(facilityId = FACILITY_ID) {
  const db = await getDb();
  if (!db) return { pending: 0, confirmed: 0, rejected: 0, cancelled: 0, total: 0 };

  const rows = await db
    .select({
      bookingStatus: bookings.bookingStatus,
      count: sql<number>`COUNT(*)`,
    })
    .from(bookings)
    .where(eq(bookings.facilityId, facilityId))
    .groupBy(bookings.bookingStatus);

  const stats = { pending: 0, confirmed: 0, rejected: 0, cancelled: 0, total: 0 };
  for (const row of rows) {
    const count = Number(row.count);
    stats[row.bookingStatus as keyof typeof stats] = count;
    stats.total += count;
  }
  return stats;
}

/** Update the payment screenshot URL on a booking. */
export async function updateBookingScreenshot(
  bookingId: number,
  screenshotUrl: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookings)
    .set({ screenshotUrl, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
}

/**
 * Admin: confirm a booking.
 *
 * BOOKING RULE: pending → confirmed.
 * payment_status → confirmed.
 * Slot remains 'booked' (stays blocked for others).
 */
export async function confirmBooking(
  bookingId: number,
  reviewedByUserId: number,
  adminNote?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookings)
    .set({
      bookingStatus: "confirmed",
      paymentStatus: "confirmed",
      adminNote: adminNote ?? null,
      reviewedAt: new Date(),
      reviewedByUserId,
      updatedAt: new Date(),
    })
    .where(and(eq(bookings.id, bookingId), eq(bookings.bookingStatus, "pending")));
}

/**
 * Admin: reject a booking.
 *
 * BOOKING RULE: pending → rejected.
 * payment_status → rejected.
 * Slot reverts to 'available' so others can book it.
 */
export async function rejectBooking(
  bookingId: number,
  reviewedByUserId: number,
  adminNote?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const booking = await getBookingById(bookingId);
  if (!booking) return;

  await db
    .update(bookings)
    .set({
      bookingStatus: "rejected",
      paymentStatus: "rejected",
      adminNote: adminNote ?? null,
      reviewedAt: new Date(),
      reviewedByUserId,
      updatedAt: new Date(),
    })
    .where(and(eq(bookings.id, bookingId), eq(bookings.bookingStatus, "pending")));

  // Free up the slot so it can be booked again
  await markSlotAvailable(booking.slotId);
}

/**
 * Admin: cancel a confirmed booking.
 *
 * BOOKING RULE: confirmed → cancelled.
 * Slot reverts to 'available'.
 */
export async function cancelBooking(
  bookingId: number,
  reviewedByUserId: number,
  adminNote?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const booking = await getBookingById(bookingId);
  if (!booking) return;

  await db
    .update(bookings)
    .set({
      bookingStatus: "cancelled",
      adminNote: adminNote ?? null,
      reviewedAt: new Date(),
      reviewedByUserId,
      updatedAt: new Date(),
    })
    .where(and(eq(bookings.id, bookingId), eq(bookings.bookingStatus, "confirmed")));

  // Free up the slot
  await markSlotAvailable(booking.slotId);
}
// ─── Facility helpers ─────────────────────────────────────────────────────────

// ─── Facility helpers ─────────────────────────────────────────────────────────

export async function getAllFacilities(): Promise<Facility[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(facilities).orderBy(facilities.id);
}

export async function createFacility(input: {
  facilityName: string;
  coachName?: string;
  coachWhatsApp?: string;
  address?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db
    .insert(facilities)
    .values({
      facilityName: input.facilityName,
      coachName: input.coachName ?? null,
      coachWhatsApp: input.coachWhatsApp ?? null,
      address: input.address ?? null,
    })
    .returning({ id: facilities.id });

  return row.id;
}
/** super_admin only: delete a facility — blocked if linked data exists */
export async function deleteFacility(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Block deletion of the primary facility (id=1)
  if (id === 1) {
    throw new Error("Cannot delete the primary facility.");
  }

  // Check for linked services
  const linkedServices = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.facilityId, id))
    .limit(1);
  if (linkedServices.length > 0) {
    throw new Error("Cannot delete: this facility has services. Delete the services first.");
  }

  // Check for linked slots
  const linkedSlots = await db
    .select({ id: slots.id })
    .from(slots)
    .where(eq(slots.facilityId, id))
    .limit(1);
  if (linkedSlots.length > 0) {
    throw new Error("Cannot delete: this facility has slots. Delete the slots first.");
  }

  // Check for linked bookings
  const linkedBookings = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.facilityId, id))
    .limit(1);
  if (linkedBookings.length > 0) {
    throw new Error("Cannot delete: this facility has bookings.");
  }

  // Check for linked facility_admin users
  const linkedUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.facilityId, id))
    .limit(1);
  if (linkedUsers.length > 0) {
    throw new Error("Cannot delete: this facility has admin users assigned. Remove them first.");
  }

  await db.delete(facilities).where(eq(facilities.id, id));
}

export async function createFacilityAdmin(input: {
  email: string;
  passwordHash: string;
  name: string;
  facilityId: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(users).values({
    email: input.email,
    passwordHash: input.passwordHash,
    name: input.name,
    role: "facility_admin",
    facilityId: input.facilityId,
  });
}
