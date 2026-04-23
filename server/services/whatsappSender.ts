import Twilio from "twilio";

const client = Twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendCoachWhatsApp(message: string) {
  try {
    const recipients = process.env.WHATSAPP_RECIPIENTS?.split(",") || [];

    for (const number of recipients) {
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${number.trim()}`,
      });
    }
  } catch (err) {
    console.error("WhatsApp send failed:", err);
  }
}
