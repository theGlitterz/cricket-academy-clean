/**
 * server/_core/notification.ts — Notification helper (self-hosted stub).
 *
 * Original Manus version sent push notifications to the platform owner.
 * Self-hosted: logs to console. Replace with nodemailer/Resend for email alerts.
 *
 * FUTURE: Replace with email notification service:
 *   import nodemailer from 'nodemailer';
 *   or use Resend: https://resend.com (free tier: 3000 emails/month)
 */

export type NotificationPayload = {
  title: string;
  content: string;
};

/**
 * Notify the facility owner of an important event.
 * Self-hosted stub: logs to console.
 * Returns true always (no-op).
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  console.log(`[Notification] ${payload.title}: ${payload.content}`);
  return true;
}
