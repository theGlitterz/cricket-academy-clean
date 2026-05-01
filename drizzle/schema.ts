import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["user", "admin", "facility_admin", "super_admin"]);
export const availabilityStatusEnum = pgEnum("availability_status", [
  "available",
  "booked",
  "blocked",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending_review",
  "confirmed",
  "rejected",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
]);

// ─── Users ────────────────────────────────────────────────────────────────────
/**
 * Admin user table for the coach/admin panel.
 * Self-hosted: credentials (email + bcrypt passwordHash) stored here.
 * role='admin' grants access to the admin panel.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  /** bcrypt hash of the admin password */
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: roleEnum("role").default("admin").notNull(),
  /** Assigned facility for facility_admin users. Null for super_admin. */
  facilityId: integer("facility_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Facilities ───────────────────────────────────────────────────────────────
/**
 * Represents a single cricket facility.
 *
 * V1 uses exactly one facility (BestCricketAcademy, id=1).
 * The schema is designed to support multiple facilities in the future —
 * all downstream tables carry a facilityId foreign key.
 */
export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  /** Display name, e.g. "BestCricketAcademy" */
  facilityName: text("facility_name").notNull(),
  /** Coach / owner full name */
  coachName: text("coach_name"),
  /** Primary WhatsApp contact for the coach */
  coachWhatsApp: text("coach_whatsapp"),
  /** UPI ID for payment, e.g. coach@upi or 9876543210@paytm */
  upiId: text("upi_id"),
  /** Cloudinary URL of the UPI QR code image */
  upiQrImageUrl: text("upi_qr_image_url"),
  /** Full address shown on the booking page */
  address: text("address"),
  /** Working hours display string, e.g. "6:00 AM – 9:00 PM" */
  workingHours: text("working_hours"),
  /** Short note shown on payment page */
  paymentInstructions: text("payment_instructions"),
  /** Google Maps link */
  googleMapsUrl: text("google_maps_url"),
  /** Whether this facility is publicly visible */
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Facility = typeof facilities.$inferSelect;
export type InsertFacility = typeof facilities.$inferInsert;

// ─── Services ─────────────────────────────────────────────────────────────────
/**
 * A bookable service offered by a facility.
 * V1 services: Ground Booking, Net Practice, Personal Coaching.
 */
export const services = pgTable(
  "services",
  {
  id: serial("id").primaryKey(),
  /** FK → facilities.id */
  facilityId: integer("facility_id").notNull(),
  /** URL-safe slug used in booking links, e.g. "ground-booking" */
  slug: text("slug").notNull(),
  /** Display name, e.g. "Ground Booking" */
  name: text("name").notNull(),
  /** Short description shown on the booking page */
  description: text("description"),
  /** Session duration in minutes */
  durationMinutes: integer("duration_minutes").notNull().default(60),
  /** Price per slot in INR */
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  /** Advance/token amount required to confirm booking (must be ≤ price) */
  advanceAmount: decimal("advance_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  /** Whether this service is available for booking */
  activeStatus: boolean("active_status").notNull().default(true),

  /** Display order on the booking page */
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("services_facility_slug_unique").on(t.facilityId, t.slug)]
);

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

// ─── Slots ────────────────────────────────────────────────────────────────────
/**
 * A specific time window on a specific date for a service at a facility.
 *
 * availability_status values:
 *   available — open for booking
 *   booked    — a confirmed or pending booking occupies this slot
 *   blocked   — admin has manually blocked this slot
 */
export const slots = pgTable("slots", {
  id: serial("id").primaryKey(),
  /** FK → facilities.id */
  facilityId: integer("facility_id").notNull(),
  /** FK → services.id */
  serviceId: integer("service_id").notNull(),
  /** Date in YYYY-MM-DD format */
  date: text("date").notNull(),
  /** Start time in HH:MM (24h) format */
  startTime: text("start_time").notNull(),
  /** End time in HH:MM (24h) format */
  endTime: text("end_time").notNull(),
  availabilityStatus: availabilityStatusEnum("availability_status")
    .notNull()
    .default("available"),
  /** Max concurrent bookings */
  maxCapacity: integer("max_capacity").notNull().default(1),
  /** Current booking count (pending + confirmed) */
  bookedCount: integer("booked_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Slot = typeof slots.$inferSelect;
export type InsertSlot = typeof slots.$inferInsert;

// ─── Bookings ─────────────────────────────────────────────────────────────────
/**
 * A player's booking request for a specific slot.
 *
 * payment_status values:
 *   pending_review — player has submitted, coach has not reviewed yet
 *   confirmed      — coach verified payment and confirmed
 *   rejected       — coach rejected
 *
 * booking_status values:
 *   pending    — submitted, awaiting coach review
 *   confirmed  — booking is confirmed
 *   rejected   — booking was rejected
 *   cancelled  — booking was cancelled after confirmation
 *
 * Status lifecycle:
 *   pending → confirmed  (coach confirms payment)
 *   pending → rejected   (coach rejects; slot reverts to available)
 *   confirmed → cancelled (admin/player cancels; slot reverts to available)
 */
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  /** Short human-readable reference, e.g. BCA-20240409-1234 */
  referenceId: text("reference_id").notNull().unique(),
  /** FK → facilities.id */
  facilityId: integer("facility_id").notNull(),
  /** FK → services.id */
  serviceId: integer("service_id").notNull(),
  /** FK → slots.id */
  slotId: integer("slot_id").notNull(),
  /** Player's full name */
  playerName: text("player_name").notNull(),
  /** WhatsApp number with country code, e.g. +919876543210 */
  playerWhatsApp: text("player_whatsapp").notNull(),
  /** Optional email */
  playerEmail: text("player_email"),
  /** Denormalized date YYYY-MM-DD */
  bookingDate: text("booking_date").notNull(),
  /** Denormalized start time HH:MM */
  startTime: text("start_time").notNull(),
  /** Denormalized end time HH:MM */
  endTime: text("end_time").notNull(),
  /** Amount in INR — copied from service price at time of booking */
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  /** Cloudinary URL of the UPI payment screenshot */
  screenshotUrl: text("screenshot_url"),
  paymentStatus: paymentStatusEnum("payment_status")
    .notNull()
    .default("pending_review"),
  bookingStatus: bookingStatusEnum("booking_status")
    .notNull()
    .default("pending"),
  /** Admin note when confirming or rejecting */
  adminNote: text("admin_note"),
  /** UTC timestamp when the booking was reviewed */
  reviewedAt: timestamp("reviewed_at"),
  /** ID of the admin user who reviewed */
  reviewedByUserId: integer("reviewed_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

// ─── Legacy alias (kept for backward compat) ──────────────────────────────────
export const facilitySettings = facilities;
export type FacilitySettings = Facility;
export type InsertFacilitySettings = InsertFacility;
