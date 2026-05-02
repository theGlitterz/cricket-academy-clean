/**
 * shared/groundPricing.ts
 * Ground Booking fixed slot schedule and pricing.
 * Single source of truth used by server (db.ts, routers.ts) and client.
 */

export const GROUND_BOOKING_SLUG = "ground-booking";

export const GROUND_SLOTS = [
  { startTime: "05:30", endTime: "09:30" }, // Slot 1
  { startTime: "10:00", endTime: "14:00" }, // Slot 2
  { startTime: "14:30", endTime: "18:30" }, // Slot 3
] as const;

type DayType = "weekday" | "saturday" | "sunday";

const PRICE_MATRIX: Record<DayType, [number, number, number]> = {
  weekday:  [3500, 3000, 3500],
  saturday: [7000, 4500, 5000],
  sunday:   [7500, 5000, 5000],
};

const ADVANCE_MATRIX: Record<DayType, [number, number, number]> = {
  weekday:  [350, 300, 350],
  saturday: [700, 450, 500],
  sunday:   [750, 500, 500],
};

/** Returns the slot index (0, 1, 2) for a given startTime, or -1 if not a ground slot. */
export function getGroundSlotIndex(startTime: string): number {
  return GROUND_SLOTS.findIndex((s) => s.startTime === startTime);
}

/** Returns the day type for a YYYY-MM-DD date string. */
export function getDayType(dateStr: string): DayType {
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "weekday";
}

/** Returns { price, advance } for a ground slot, or null if startTime is not a ground slot. */
export function getGroundSlotPricing(
  dateStr: string,
  startTime: string
): { price: number; advance: number } | null {
  const idx = getGroundSlotIndex(startTime);
  if (idx === -1) return null;
  const dt = getDayType(dateStr);
  return { price: PRICE_MATRIX[dt][idx], advance: ADVANCE_MATRIX[dt][idx] };
}
