// ─── Cricket-specific shared constants for BestCricketAcademy ────────────────

export type ServiceSlug = "ground-booking" | "net-practice" | "personal-coaching";
export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export const SERVICE_DISPLAY: Record<
  ServiceSlug,
  { emoji: string; tagline: string; colorClass: string }
> = {
  "ground-booking": {
    emoji: "🏏",
    tagline: "Full ground for match practice or training sessions",
    colorClass: "bg-primary/10 text-primary",
  },
  "net-practice": {
    emoji: "🎯",
    tagline: "Dedicated net lanes for batting and bowling drills",
    colorClass: "bg-secondary text-secondary-foreground",
  },
  "personal-coaching": {
    emoji: "👨‍🏫",
    tagline: "One-on-one coaching with our certified cricket coach",
    colorClass: "bg-accent/20 text-accent-foreground",
  },
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending Review",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const STATUS_CSS: Record<BookingStatus, string> = {
  pending: "status-pending",
  confirmed: "status-confirmed",
  rejected: "status-rejected",
  cancelled: "status-cancelled",
};

/** Default seed data for the 3 services */
export const DEFAULT_SERVICES = [
  {
    slug: "ground-booking" as ServiceSlug,
    name: "Ground Booking",
    description:
      "Book the full cricket ground for your team practice, match simulation, or training camp. Includes pitch and outfield.",
    pricePerSlot: "1500.00",
    durationMinutes: 120,
    maxCapacity: 1,
    isActive: true,
    sortOrder: 1,
  },
  {
    slug: "net-practice" as ServiceSlug,
    name: "Net Practice",
    description:
      "Reserve a dedicated net lane for focused batting or bowling drills. Ideal for individual or small group training.",
    pricePerSlot: "500.00",
    durationMinutes: 60,
    maxCapacity: 2,
    isActive: true,
    sortOrder: 2,
  },
  {
    slug: "personal-coaching" as ServiceSlug,
    name: "Personal Coaching",
    description:
      "One-on-one coaching session with our certified coach. Tailored feedback on technique, fitness, and game strategy.",
    pricePerSlot: "800.00",
    durationMinutes: 60,
    maxCapacity: 1,
    isActive: true,
    sortOrder: 3,
  },
];
