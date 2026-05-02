/**
 * Shared Constants for BestCricketAcademy
 *
 * This file is the single source of truth for IDs, enums, and config values
 * shared between the server and client.
 *
 * FUTURE: Multi-facility support
 *   When expanding to multiple facilities, replace FACILITY_ID with a
 *   dynamic lookup from the authenticated user's session or subdomain.
 *   All server queries already accept facilityId as a parameter — only
 *   the constant below needs to change.
 */

// ─── Facility ─────────────────────────────────────────────────────────────────

/**
 * The single facility ID for V1.
 * FUTURE: Multi-facility — derive this from session/subdomain/URL param.
 */
export const FACILITY_ID = 1;

export const FACILITY_NAME = "BestCricketAcademy";

// ─── Service Slugs ────────────────────────────────────────────────────────────

export const SERVICE_SLUGS = {
  GROUND_BOOKING: "ground-booking",
  NET_PRACTICE: "net-practice",
  PERSONAL_COACHING: "personal-coaching",
} as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[keyof typeof SERVICE_SLUGS];

// ─── Booking Status ───────────────────────────────────────────────────────────

export const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  REJECTED: "rejected",
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

// ─── Payment Status ───────────────────────────────────────────────────────────

export const PAYMENT_STATUS = {
  PENDING_REVIEW: "pending_review",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// ─── Slot Availability ────────────────────────────────────────────────────────

export const SLOT_STATUS = {
  AVAILABLE: "available",
  BOOKED: "booked",
  BLOCKED: "blocked",
} as const;

export type SlotStatus = (typeof SLOT_STATUS)[keyof typeof SLOT_STATUS];

// ─── UI Labels ────────────────────────────────────────────────────────────────

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pending Review",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending_review: "Awaiting Review",
  confirmed: "Payment Confirmed",
  rejected: "Payment Rejected",
};

// ─── File Upload Limits ───────────────────────────────────────────────────────

/** Maximum screenshot upload size in bytes (5 MB) */
export const MAX_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024;

/** Maximum QR code image size in bytes (2 MB) */
export const MAX_QR_SIZE_BYTES = 2 * 1024 * 1024;

// ─── Booking Slot Window ─────────────────────────────────────────────────────

/** Number of days ahead to show in the date scroller */
export const BOOKING_WINDOW_DAYS = 14;

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

/**
 * FUTURE: WhatsApp Business API
 * When integrating WhatsApp notifications, these env vars must be set:
 *   WHATSAPP_API_TOKEN         — Bearer token from Meta Business API
 *   WHATSAPP_PHONE_NUMBER_ID   — Your registered WhatsApp Business phone number ID
 *   WHATSAPP_API_VERSION       — Meta Graph API version (e.g. "v18.0")
 *
 * See: server/services/whatsapp.ts for the full integration guide.
 */
export const WHATSAPP_ENABLED = false; // Set to true when API is configured

// ─── Payment ──────────────────────────────────────────────────────────────────

/**
 * FUTURE: Automated Payment Verification
 * V1 uses manual UPI screenshot review by the coach.
 * Future options for automation:
 *   - Razorpay webhook: verify payment via order ID
 *   - PayU webhook: verify via transaction ID
 *   - UPI deep link with callback: generate payment link with reference ID
 *
 * The booking reference ID is already designed to be used as the payment
 * reference — players are instructed to include it in the UPI remarks.
 */
export const PAYMENT_AUTOMATION_ENABLED = false; // Set to true when integrated

// ─── Manual Booking (MVP) ─────────────────────────────────────────────────────
/**
 * TODO: Replace adminNote prefix with a dedicated `booking_source` column post-MVP.
 *       See: https://github.com/your-repo/issues — add `booking_source` enum to bookings table.
 *
 * MVP approach: manual bookings are identified by this prefix in adminNote.
 * Do NOT use this prefix in Razorpay or any payment verification logic.
 */
export const MANUAL_BOOKING_PREFIX = "[MANUAL]";

/**
 * Returns true if the booking was created manually by an admin
 * (walk-in / phone booking, payment not collected via platform ).
 *
 * @param booking - any object with an optional adminNote string field
 */
export function isManualBooking(booking: { adminNote?: string | null }): boolean {
  return typeof booking.adminNote === "string" &&
    booking.adminNote.startsWith(MANUAL_BOOKING_PREFIX);
}
