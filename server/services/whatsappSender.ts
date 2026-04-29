
## FILE — `server/services/whatsappSender.ts`

**Replace the entire file with:**

```ts
/**
 * Twilio WhatsApp Sender
 *
 * Sends automatic WhatsApp notifications after Razorpay booking confirmation.
 *
 * Recipients:
 *   1. coachNumber  — facility.coachWhatsApp from DB (always, if set)
 *   2. TWILIO_ADMIN_WHATSAPP_RECIPIENTS — optional env var for platform admin
 *      Format: comma-separated, e.g. whatsapp:+919876543210,whatsapp:+919123456789
 *
 * Required env vars:
 *   TWILIO_SID              — Twilio Account SID
 *   TWILIO_AUTH_TOKEN       — Twilio Auth Token
 *   TWILIO_WHATSAPP_NUMBER  — Twilio sandbox sender, e.g. +14155238886
 *
 * Optional env vars:
 *   TWILIO_ADMIN_WHATSAPP_RECIPIENTS — additional admin recipients (comma-separated)
 */

/** Normalise a phone number to whatsapp:+XXXXXXXXXXX format */
function normaliseToWhatsApp(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  const digits = trimmed.replace(/[\s\-()]/g, "");
  return `whatsapp:${digits.startsWith("+") ? digits : `+${digits}`}`;
}

/** Mask number for logging — show only last 4 digits */
function maskNumber(wa: string): string {
  const digits = wa.replace(/\D/g, "");
  return `****${digits.slice(-4)}`;
}

export async function sendCoachWhatsApp(
  message: string,
  coachNumber: string
): Promise<void> {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;

  console.log(`[Twilio] Coach number present: ${Boolean(coachNumber && coachNumber.trim().length > 5)}`);
  console.log(`[Twilio] From number present: ${Boolean(from)}`);

  if (!sid || !token || !from) {
    console.warn("[Twilio] Skipped — TWILIO_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_NUMBER not set in env");
    return;
  }

  // Build recipient list — coach first, then optional admin recipients
  const recipients: string[] = [];

  if (coachNumber && coachNumber.trim().length > 5) {
    recipients.push(normaliseToWhatsApp(coachNumber));
  }

  const adminRaw = process.env.TWILIO_ADMIN_WHATSAPP_RECIPIENTS;
  if (adminRaw) {
    for (const r of adminRaw.split(",")) {
      if (r.trim()) recipients.push(normaliseToWhatsApp(r));
    }
  }

  // Deduplicate
  const unique = [...new Set(recipients)];

  if (unique.length === 0) {
    console.warn("[Twilio] Skipped — no recipients (coachWhatsApp empty and TWILIO_ADMIN_WHATSAPP_RECIPIENTS not set)");
    return;
  }

  const fromFormatted = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  try {
    const { default: Twilio } = await import("twilio");
    const client = Twilio(sid, token);

    for (const to of unique) {
      const isCoach = to === normaliseToWhatsApp(coachNumber);
      const label = isCoach ? "coach" : "admin";
      try {
        console.log(`[Twilio] Sending to ${label} (${maskNumber(to)})`);
        const result = await client.messages.create({ body: message, from: fromFormatted, to });
        console.log(`[Twilio] Sent message SID: ${result.sid}`);
      } catch (err: unknown) {
        const e = err as { code?: number; message?: string };
        console.error(`[Twilio] Failed for ${label} recipient (${maskNumber(to)}): code=${e?.code ?? "unknown"} message=${e?.message ?? String(err)}`);
        // Continue to next recipient — never throw
      }
    }
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error(`[Twilio] Twilio client init failed: ${e?.message ?? String(err)}`);
    // Booking remains confirmed
  }
}
