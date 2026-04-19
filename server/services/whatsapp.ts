/**
 * WhatsApp Notification Service — Placeholder for Future Integration
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CURRENT STATE (V1):
 *   This file contains message template generators that produce the exact text
 *   that would be sent via WhatsApp. In V1, these are used for:
 *     1. The "Share via WhatsApp" button on the booking done screen
 *     2. Copy-paste message templates for the coach
 *
 * FUTURE INTEGRATION (WhatsApp Business API):
 *   To enable automatic WhatsApp notifications, you need:
 *     1. A Meta Business account with WhatsApp Business API access
 *     2. A verified phone number registered in Meta Business Manager
 *     3. Approved message templates (for transactional messages)
 *
 *   Required environment variables (add to .env):
 *     WHATSAPP_API_TOKEN=           # Bearer token from Meta Business API
 *     WHATSAPP_PHONE_NUMBER_ID=     # Your WhatsApp Business phone number ID
 *     WHATSAPP_API_VERSION=v18.0    # Meta Graph API version
 *
 *   Integration steps:
 *     1. Uncomment the `sendWhatsAppMessage()` function below
 *     2. Call it from the booking lifecycle hooks in server/routers.ts
 *        (search for "FUTURE: WhatsApp notification" comments)
 *     3. Register message templates in Meta Business Manager matching
 *        the template names used in `sendTemplateMessage()`
 *
 *   Reference: https://developers.facebook.com/docs/whatsapp/cloud-api
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Message Template Generators ─────────────────────────────────────────────
// These produce human-readable booking messages. Used today for WhatsApp share
// links; can be passed to the API in the future.

export interface BookingMessageData {
  playerName: string;
  serviceName: string;
  bookingDate: string; // e.g. "15 Apr 2026"
  startTime: string;   // e.g. "6:00 AM"
  endTime: string;     // e.g. "8:00 AM"
  amount: number;
  referenceId: string;
  facilityName: string;
  coachWhatsApp: string;
}

/**
 * Message sent to the player after they submit a booking request.
 * Used in the "Share via WhatsApp" button on the booking done screen.
 */
export function buildBookingRequestMessage(data: BookingMessageData): string {
  return (
    `🏏 *Booking Request Submitted*\n\n` +
    `Hi ${data.playerName}! Your booking request has been received.\n\n` +
    `*Service:* ${data.serviceName}\n` +
    `*Date:* ${data.bookingDate}\n` +
    `*Time:* ${data.startTime} – ${data.endTime}\n` +
    `*Amount:* ₹${data.amount}\n` +
    `*Reference:* ${data.referenceId}\n\n` +
    `Your booking is *pending payment review*. The coach will confirm once payment is verified.\n\n` +
    `Track your booking: ${typeof window !== "undefined" ? window.location.origin : ""}/booking/${data.referenceId}`
  );
}

/**
 * Message sent to the player when their booking is confirmed by the coach.
 * FUTURE: Call this from the `bookings.confirm` tRPC procedure.
 */
export function buildBookingConfirmedMessage(data: BookingMessageData): string {
  return (
    `✅ *Booking Confirmed!*\n\n` +
    `Hi ${data.playerName}! Your booking has been confirmed.\n\n` +
    `*Service:* ${data.serviceName}\n` +
    `*Date:* ${data.bookingDate}\n` +
    `*Time:* ${data.startTime} – ${data.endTime}\n` +
    `*Reference:* ${data.referenceId}\n\n` +
    `See you on the ground! 🏏\n\n` +
    `For any queries, contact: ${data.coachWhatsApp}`
  );
}

/**
 * Message sent to the player when their booking is rejected by the coach.
 * FUTURE: Call this from the `bookings.reject` tRPC procedure.
 */
export function buildBookingRejectedMessage(
  data: BookingMessageData,
  adminNote?: string
): string {
  return (
    `❌ *Booking Rejected*\n\n` +
    `Hi ${data.playerName}, unfortunately your booking request could not be confirmed.\n\n` +
    `*Service:* ${data.serviceName}\n` +
    `*Date:* ${data.bookingDate}\n` +
    `*Reference:* ${data.referenceId}\n\n` +
    (adminNote ? `*Reason:* ${adminNote}\n\n` : "") +
    `Please contact the coach to rebook: ${data.coachWhatsApp}`
  );
}

/**
 * Notification sent to the coach when a new booking request is submitted.
 * FUTURE: Call this from the `bookings.create` tRPC procedure.
 */
export function buildCoachNewBookingAlert(data: BookingMessageData): string {
  return (
    `🔔 *New Booking Request*\n\n` +
    `*Player:* ${data.playerName}\n` +
    `*Service:* ${data.serviceName}\n` +
    `*Date:* ${data.bookingDate}\n` +
    `*Time:* ${data.startTime} – ${data.endTime}\n` +
    `*Amount:* ₹${data.amount}\n` +
    `*Reference:* ${data.referenceId}\n\n` +
    `Review and confirm in the admin panel.`
  );
}

/**
 * Builds a wa.me deep link with a pre-filled message.
 * Used for "Share via WhatsApp" and "Contact Coach" buttons.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  // Normalize phone: remove spaces, dashes, ensure + prefix
  const normalized = phone.replace(/[\s\-()]/g, "");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encoded}`;
}

// ─── FUTURE: WhatsApp Cloud API Integration ───────────────────────────────────
// Uncomment and configure the section below when ready to send automatic
// WhatsApp messages via the Meta WhatsApp Business Cloud API.
//
// import axios from "axios";
//
// const WA_API_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/`;
// const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
// const WA_TOKEN = process.env.WHATSAPP_API_TOKEN;
//
// export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
//   try {
//     await axios.post(
//       `${WA_API_URL}${WA_PHONE_ID}/messages`,
//       {
//         messaging_product: "whatsapp",
//         to: to.replace(/\D/g, ""), // strip non-digits
//         type: "text",
//         text: { body: message },
//       },
//       { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
//     );
//     return true;
//   } catch (err) {
//     console.error("[WhatsApp] Failed to send message:", err);
//     return false;
//   }
// }
//
// export async function sendTemplateMessage(
//   to: string,
//   templateName: string,
//   components: object[]
// ): Promise<boolean> {
//   try {
//     await axios.post(
//       `${WA_API_URL}${WA_PHONE_ID}/messages`,
//       {
//         messaging_product: "whatsapp",
//         to: to.replace(/\D/g, ""),
//         type: "template",
//         template: { name: templateName, language: { code: "en" }, components },
//       },
//       { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
//     );
//     return true;
//   } catch (err) {
//     console.error("[WhatsApp] Failed to send template:", err);
//     return false;
//   }
// }
