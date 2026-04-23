/**
 * Booking utility functions for BestCricketAcademy.
 *
 * Includes WhatsApp message generators that are used today for the
 * "Share via WhatsApp" button, and can be wired to the WhatsApp API later.
 *
 * FUTURE: WhatsApp API integration
 *   These message strings are already formatted for WhatsApp.
 *   When the API is ready, pass them to `sendWhatsAppMessage()` in
 *   server/services/whatsapp.ts instead of encoding them as wa.me links.
 */

import { formatBookingDate, formatCurrency, formatTimeRange } from "./format";

export interface BookingSummary {
  playerName: string;
  serviceName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  amount: number;
  referenceId: string;
  facilityName?: string;
  coachWhatsApp?: string;
}

/**
 * Build the WhatsApp share message shown on the booking done screen.
 * Players can tap "Share via WhatsApp" to send this to the coach or themselves.
 */
export function buildShareMessage(booking: BookingSummary): string {
  const date = formatBookingDate(booking.bookingDate);
  const time = formatTimeRange(booking.startTime, booking.endTime);
  const amount = formatCurrency(booking.amount);

  return (
    `🏏 *${booking.facilityName ?? "BestCricketAcademy"} — Booking Request*\n\n` +
    `Hi! I've submitted a booking request.\n\n` +
    `*Service:* ${booking.serviceName}\n` +
    `*Date:* ${date}\n` +
    `*Time:* ${time}\n` +
    `*Amount:* ${amount}\n` +
    `*Reference:* ${booking.referenceId}\n\n` +
    `Payment has been sent. Please confirm. 🙏`
  );
}

/**
 * Build a WhatsApp deep link (wa.me) with a pre-filled message.
 * Used for "Contact Coach on WhatsApp" and "Share Booking" buttons.
 */
/**
 * Build the confirmed booking message from player to coach.
 * Used on the booking success screen — "Send details to coach on WhatsApp".
 */
export interface ConfirmedBookingSummary {
  playerName: string;
  serviceName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  referenceId: string;
  totalPrice: number;
  advancePaid: number;
  remainingAtGround: number;
  facilityName?: string;
}
export function buildPlayerToCoachMessage(b: ConfirmedBookingSummary): string {
  const date = formatBookingDate(b.bookingDate);
  const time = formatTimeRange(b.startTime, b.endTime);
  return (
    `🏏 *Booking Confirmed — ${b.facilityName ?? "BestCricketAcademy"}*\n\n` +
    `Hi! My booking is confirmed. Here are the details:\n\n` +
    `*Name:* ${b.playerName}\n` +
    `*Service:* ${b.serviceName}\n` +
    `*Date:* ${date}\n` +
    `*Time:* ${time}\n` +
    `*Reference:* ${b.referenceId}\n\n` +
    `*Total Price:* ₹${b.totalPrice.toLocaleString("en-IN")}\n` +
    `*Advance Paid:* ₹${b.advancePaid.toLocaleString("en-IN")}\n` +
    `*Remaining at Ground:* ₹${b.remainingAtGround.toLocaleString("en-IN")}\n\n` +
    `Payment screenshot has been uploaded. See you at the ground! 🙏`
  );
}


export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = phone.replace(/[\s\-()]/g, "");
  const withPlus = normalized.startsWith("+") ? normalized : `+${normalized}`;
  return `https://wa.me/${withPlus.replace("+", "")}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a WhatsApp link for the coach to contact a player about their booking.
 * Used in AdminBookingDetail for the "WhatsApp Player" button.
 */
export function buildCoachToPlayerLink(
  playerWhatsApp: string,
  booking: BookingSummary
): string {
  const date = formatBookingDate(booking.bookingDate);
  const time = formatTimeRange(booking.startTime, booking.endTime);

  const message =
    `Hi ${booking.playerName}! 👋\n\n` +
    `This is regarding your booking at ${booking.facilityName ?? "BestCricketAcademy"}.\n\n` +
    `*Service:* ${booking.serviceName}\n` +
    `*Date:* ${date}\n` +
    `*Time:* ${time}\n` +
    `*Reference:* ${booking.referenceId}`;

  return buildWhatsAppLink(playerWhatsApp, message);
}

/**
 * Generate a human-readable booking reference ID.
 * Format: BCA-YYYYMMDD-XXXX (e.g. BCA-20260415-A3F2)
 */
export function generateReferenceId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BCA-${dateStr}-${random}`;
}

/**
 * Validate an Indian mobile number.
 * Accepts: 10-digit numbers, optionally prefixed with +91 or 0.
 */
export function validateIndianPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-+()]/g, "");
  // Accept 10-digit (no prefix), 11-digit (0 prefix), or 12-digit (+91 prefix)
  if (digits.length === 10) return /^[6-9]\d{9}$/.test(digits);
  if (digits.length === 11) return /^0[6-9]\d{9}$/.test(digits);
  if (digits.length === 12) return /^91[6-9]\d{9}$/.test(digits);
  return false;
}

/**
 * Normalize a phone number to +91XXXXXXXXXX format for storage.
 */
export function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/[\s\-+()]/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return phone; // return as-is if format is unrecognized
}
