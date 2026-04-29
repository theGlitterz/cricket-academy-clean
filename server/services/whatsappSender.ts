/**
 * Twilio WhatsApp Sender — Coach Notification Only
 *
 * Sends an automatic WhatsApp message to the coach/facility owner
 * after a Razorpay booking is confirmed.
 *
 * Required env vars:
 *   TWILIO_SID              — Twilio Account SID
 *   TWILIO_AUTH_TOKEN       — Twilio Auth Token
 *   TWILIO_WHATSAPP_NUMBER  — Twilio sandbox sender, e.g. +14155238886
 *
 * The recipient (coachNumber) comes from facility.coachWhatsApp in the DB.
 * No WHATSAPP_RECIPIENTS env var is needed.
 */
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

  if (!coachNumber || coachNumber.trim().length < 6) {
    console.warn("[Twilio] Skipped — coachWhatsApp is empty in facility settings");
    return;
  }

  // Normalise: strip non-digit chars except leading +, then ensure whatsapp: prefix
  const normalised = coachNumber.trim().replace(/[\s\-()]/g, "");
  const to = normalised.startsWith("whatsapp:") ? normalised : `whatsapp:${normalised}`;
  const fromFormatted = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  try {
    const { default: Twilio } = await import("twilio");
    const client = Twilio(sid, token);

    console.log("[Twilio] Sending coach booking notification");
    const result = await client.messages.create({
      body: message,
      from: fromFormatted,
      to,
    });
    console.log(`[Twilio] Sent message SID: ${result.sid}`);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    console.error(`[Twilio] Failed: code=${e?.code ?? "unknown"} message=${e?.message ?? String(err)}`);
    // Do NOT rethrow — booking must remain confirmed even if WhatsApp fails
  }
}
