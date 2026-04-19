/**
 * Shared formatting utilities for BestCricketAcademy.
 * Used across player-facing pages and admin pages for consistent display.
 */

/**
 * Format a date string (YYYY-MM-DD) to a human-readable display format.
 * e.g. "2026-04-15" → "Wed, 15 Apr"
 */
export function formatBookingDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Format a date string to a long display format.
 * e.g. "2026-04-15" → "Wednesday, 15 April 2026"
 */
export function formatBookingDateLong(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format a time string (HH:MM or HH:MM:SS) to 12-hour AM/PM format.
 * e.g. "06:00:00" → "6:00 AM"
 */
export function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [hourStr, minuteStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

/**
 * Format a time range for display.
 * e.g. ("06:00:00", "08:00:00") → "6:00 AM – 8:00 AM"
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

/**
 * Format a currency amount in Indian Rupees.
 * e.g. 1500 → "₹1,500"
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * Format a UTC timestamp to a local date+time string.
 * e.g. 1712345678000 → "15 Apr 2026, 6:00 AM"
 */
export function formatTimestamp(timestamp: Date | string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format a WhatsApp number for display (add spaces for readability).
 * e.g. "+919876543210" → "+91 98765 43210"
 */
export function formatWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

/**
 * Returns "Today", "Tomorrow", or the formatted date string.
 */
export function formatRelativeDate(dateStr: string): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayStr = today.toISOString().split("T")[0];
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";
  return formatBookingDate(dateStr);
}
