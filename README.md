# BestCricketAcademy — Booking Web App

A mobile-first full-stack web application that helps a single cricket facility manage bookings for **Ground Booking**, **Net Practice**, and **Personal Coaching** — replacing WhatsApp chaos with a clean, structured booking flow.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Seeding Demo Data](#seeding-demo-data)
- [Deployment](#deployment)
- [User Roles & Access](#user-roles--access)
- [Changing Coach Number & Facility Settings](#changing-coach-number--facility-settings)
- [Future: WhatsApp Integration](#future-whatsapp-integration)
- [Future: Multi-Facility Support](#future-multi-facility-support)
- [Future: Automated Payment Verification](#future-automated-payment-verification)
- [Booking Rules & Business Logic](#booking-rules--business-logic)
- [API Reference (tRPC)](#api-reference-trpc)

---

## Overview

**Problem solved:** The coach was managing all bookings via WhatsApp — enquiries, slot booking, payment collection, reminders, and cancellations. This created booking chaos and wasted time.

**V1 solution:** A simple mobile web app that:
- Lets players book slots in 4 steps (service → date/slot → details → UPI payment)
- Shows the coach's UPI QR code for manual payment
- Requires players to upload a payment screenshot
- Lets the coach review and confirm/reject bookings from an admin panel
- Prevents double-booking automatically

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Node.js, Express 4, tRPC 11 |
| Database | MySQL (via Drizzle ORM) |
| File Storage | S3-compatible (payment screenshots, QR codes) |
| Auth | Manus OAuth (role-based: `user` / `admin`) |
| Fonts | Inter (body), Syne (headings) |
| Testing | Vitest |

---

## Project Structure

```
best-cricket-academy/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx                  ← Landing page with service cards and hero
│       │   ├── BookingPage.tsx           ← 5-step player booking flow
│       │   ├── BookingStatusPage.tsx     ← Track booking by ref or WhatsApp
│       │   └── admin/
│       │       ├── AdminLayout.tsx       ← Shared admin shell + sidebar nav
│       │       ├── AdminDashboard.tsx    ← Stats, today's bookings, pending review
│       │       ├── AdminBookings.tsx     ← Booking list with search + filter tabs
│       │       ├── AdminBookingDetail.tsx← Full detail, screenshot, confirm/reject
│       │       ├── AdminSlots.tsx        ← Create, block/unblock, bulk create slots
│       │       └── AdminSettings.tsx     ← Facility config, UPI ID, QR code upload
│       ├── components/
│       │   ├── StatusBadge.tsx           ← Reusable status pill (booking/payment/slot)
│       │   ├── EmptyState.tsx            ← Consistent empty state for list pages
│       │   └── PageLoader.tsx            ← Loading skeletons (booking, stats, slot)
│       ├── lib/utils/
│       │   ├── format.ts                 ← Date, time, currency, WhatsApp formatters
│       │   └── booking.ts                ← WhatsApp message text generators
│       ├── App.tsx                       ← Route definitions
│       └── index.css                     ← Cricket-inspired theme tokens (OKLCH)
├── server/
│   ├── routers.ts                        ← All tRPC procedures (facility, services, slots, bookings)
│   ├── db.ts                             ← Drizzle query helpers (FACILITY_ID constant here)
│   ├── storage.ts                        ← S3 file upload helpers
│   ├── seed.ts                           ← Demo data seeder (facility, services, slots, bookings)
│   ├── services/
│   │   └── whatsapp.ts                   ← WhatsApp message builders (V1: manual links, V2: API)
│   ├── bookings.test.ts                  ← Vitest tests for booking procedures
│   └── auth.logout.test.ts               ← Auth test (template)
├── drizzle/
│   └── schema.ts                         ← 5 tables: users, facilities, services, slots, bookings
├── shared/
│   ├── const.ts                          ← Cookie name, shared constants
│   ├── constants.ts                      ← App-wide constants + FUTURE extension points
│   └── types.ts                          ← Shared TypeScript types
├── .env.example                          ← Environment variable template
└── README.md                             ← This file
```

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A MySQL-compatible database (local or cloud)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-org/best-cricket-academy.git
cd best-cricket-academy

# 2. Install dependencies
pnpm install

# 3. Copy environment variables
cp .env.example .env
# Edit .env and fill in your DATABASE_URL and other values

# 4. Apply database migrations
pnpm db:push

# 5. Seed demo data (recommended for first run)
npx tsx server/seed.ts

# 6. Start the development server
pnpm dev
```

The app will be available at `http://localhost:3000`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string |
| `JWT_SECRET` | Yes | Secret for session cookie signing |
| `VITE_APP_ID` | Yes | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Yes | Manus OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | Yes | Manus login portal URL |
| `OWNER_OPEN_ID` | Yes | Coach's Manus account OpenID (auto-promoted to admin) |
| `OWNER_NAME` | Yes | Coach's display name |
| `BUILT_IN_FORGE_API_URL` | Yes | Manus built-in API base URL |
| `BUILT_IN_FORGE_API_KEY` | Yes | Server-side API key for Manus APIs |
| `VITE_FRONTEND_FORGE_API_KEY` | Yes | Frontend API key for Manus APIs |
| `VITE_FRONTEND_FORGE_API_URL` | Yes | Frontend Manus API URL |

> **Security:** Never commit `.env` files to version control. All environment variables should be managed through your hosting provider's secrets manager.

---

## Database Setup

The schema is defined in `drizzle/schema.ts`. The database has 5 tables:

| Table | Purpose |
|---|---|
| `users` | Coach/admin accounts (Manus OAuth) |
| `facilities` | Facility config: name, coach, UPI, address, working hours |
| `services` | Ground Booking, Net Practice, Personal Coaching |
| `slots` | Available time slots per service per date |
| `bookings` | Full booking lifecycle with payment tracking |

### Running Migrations

```bash
# Generate migration SQL from schema changes
pnpm drizzle-kit generate

# Apply migrations to the database
pnpm drizzle-kit migrate

# Or use the combined shortcut:
pnpm db:push
```

### Schema Changes

Edit `drizzle/schema.ts`, then run the generate + migrate commands. The schema is the single source of truth — never edit the database directly for structural changes.

---

## Seeding Demo Data

The seed script populates the database with:
- BestCricketAcademy facility record
- 3 services (Ground Booking ₹1,500, Net Practice ₹500, Personal Coaching ₹1,000)
- 378 time slots across 14 days (6AM–10AM and 3PM–9PM)
- 4 demo bookings in all statuses (pending, confirmed, rejected, cancelled)

```bash
npx tsx server/seed.ts
```

> **Warning:** Running the seed script on a database that already has data will skip duplicate inserts. It is safe to run multiple times.

---

## Deployment

### Manus (Built-in Hosting — Recommended)

1. Save a checkpoint in the Manus UI
2. Click the **Publish** button in the top-right corner
3. Optionally configure a custom domain in Settings → Domains

### Vercel

1. Push the repository to GitHub
2. Connect the repository to Vercel
3. Set all environment variables in Vercel dashboard (Settings → Environment Variables)
4. Build command: `pnpm build`
5. Output directory: `dist`

### Other Platforms (Railway, Render, etc.)

- Build: `pnpm build`
- Start: `node dist/index.js`
- Set all environment variables in your hosting provider's dashboard

---

## User Roles & Access

| Role | Access |
|---|---|
| **Player** (public) | Landing page, booking flow, booking status page — no login required |
| **Admin/Coach** | All of the above + admin panel at `/admin` — requires login |

### How Admin Access Works

The `OWNER_OPEN_ID` environment variable automatically promotes the coach's Manus account to admin on first login. This is the simplest approach for a single-coach V1.

To promote additional users to admin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'coach@example.com';
```

---

## Changing Coach Number & Facility Settings

The coach's WhatsApp number, UPI ID, QR code, and all facility details are stored in the `facilities` table and are **fully editable** from the admin panel — they are not hardcoded anywhere.

### Via Admin Panel (Recommended)

1. Log in at `/admin`
2. Go to **Settings** in the sidebar
3. Edit any field and click **Save Changes**

Fields available:
- Facility name, coach name, address
- Coach WhatsApp number (used for player contact links)
- UPI ID (displayed to players during payment)
- UPI QR code image (upload from device)
- Working hours, payment instructions

### Via Database (For Initial Setup)

```sql
UPDATE facilities
SET
  coachWhatsApp = '919876543210',  -- Format: 91 + 10-digit number (no spaces/dashes)
  upiId = 'coach@upi',
  coachName = 'Coach Ravi Kumar',
  facilityName = 'BestCricketAcademy'
WHERE id = 1;
```

---

## Future: WhatsApp Integration

The codebase is structured to make WhatsApp integration straightforward. All groundwork is in place.

### What's Already Built

- `server/services/whatsapp.ts` — message template builders for all booking events
- `shared/constants.ts` — `WHATSAPP_CONFIG` with API endpoint placeholders
- All booking records store `playerWhatsApp` in E.164 format (e.g., `919876543210`)
- The booking router has `// FUTURE: WhatsApp notification` comments at every trigger point (confirm, reject, cancel)

### Integration Steps (When Ready)

1. Sign up for [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp) (Meta) or a provider like [Twilio](https://www.twilio.com/whatsapp) or [Wati](https://www.wati.io).

2. Add credentials to environment variables:
   ```
   WHATSAPP_API_URL=https://api.your-provider.com
   WHATSAPP_API_KEY=your_api_key
   WHATSAPP_PHONE_NUMBER_ID=your_phone_id
   ```

3. Implement `sendWhatsAppMessage()` in `server/services/whatsapp.ts` (the function signature is already defined with a `// TODO` comment).

4. Uncomment the `// FUTURE:` lines in `server/routers.ts` at the confirm, reject, and cancel procedures.

### Message Templates Available

| Event | Function in `whatsapp.ts` |
|---|---|
| Booking created | `buildBookingCreatedMessage()` |
| Booking confirmed | `buildBookingConfirmedMessage()` |
| Booking rejected | `buildBookingRejectedMessage()` |
| Booking cancelled | `buildBookingCancelledMessage()` |
| Payment reminder | `buildPaymentReminderMessage()` |

All templates generate properly formatted WhatsApp messages with booking details, reference IDs, and next-step instructions.

---

## Future: Multi-Facility Support

The database schema is designed to support multiple facilities. Every table (`services`, `slots`, `bookings`) has a `facilityId` foreign key. The only change needed for V2 is in `server/db.ts`:

```typescript
// Current V1 — single facility constant
// See the full FUTURE comment block in db.ts for migration options
export const FACILITY_ID = 1;

// FUTURE options:
// Option A: From authenticated user's facilityId (multi-coach SaaS)
// Option B: From subdomain (e.g. bestcricket.yourapp.com → facilityId=1)
// Option C: From URL parameter (e.g. /facility/1/book)
```

All DB helper functions already accept `facilityId` as a parameter — no schema changes are needed to support multiple facilities.

---

## Future: Automated Payment Verification

V1 uses manual UPI payment verification (player uploads screenshot, coach reviews). To automate in V2:

- **Razorpay / Cashfree / PayU:** Replace the UPI QR display with a payment gateway checkout. On successful payment webhook, auto-confirm the booking by calling `confirmBooking()`.
- **UPI Deep Link:** Use `upi://pay?pa=upiid&pn=name&am=amount` for one-tap payment from mobile. The screenshot upload step can remain as a fallback.
- **Webhook endpoint:** Add a `/api/payment/webhook` Express route in `server/_core/index.ts`.

The booking status flow (`pending → confirmed`) and slot management logic do not need to change.

---

## Booking Rules & Business Logic

All rules are enforced in `server/db.ts` (not just the router layer):

| Rule | Implementation |
|---|---|
| No double-booking | `markSlotBooked()` uses atomic `UPDATE WHERE availabilityStatus = 'available'` |
| Booking created | `bookingStatus=pending`, `paymentStatus=pending_review`, slot → `booked` |
| Coach confirms | `bookingStatus=confirmed`, `paymentStatus=confirmed`, slot stays `booked` |
| Coach rejects | `bookingStatus=rejected`, `paymentStatus=rejected`, slot → `available` (freed) |
| Coach cancels | `bookingStatus=cancelled`, slot → `available` (freed); only confirmed bookings |
| Pending cannot be cancelled | Must be rejected instead; enforced in the cancel procedure |

### Status Enums

**Booking status:** `pending` → `confirmed` / `rejected` / `cancelled`

**Payment status:** `pending_review` → `confirmed` / `rejected`

**Slot availability:** `available` / `booked` / `blocked`

---

## API Reference (tRPC)

All procedures are under `/api/trpc`. Public procedures require no authentication; admin procedures require `role = admin`.

### Facility

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `facility.get` | query | public | Get facility info (name, UPI, hours) |
| `facility.update` | mutation | admin | Update facility settings |
| `facility.uploadQr` | mutation | admin | Upload UPI QR code image |

### Services

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `services.list` | query | public | Get active services |
| `services.adminList` | query | admin | Get all services including inactive |
| `services.upsert` | mutation | admin | Create or update a service |

### Slots

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `slots.getAvailable` | query | public | Get available slots for a service + date |
| `slots.getForRange` | query | admin | Get slots for a date range |
| `slots.getByDate` | query | admin | Get all slots for a specific date |
| `slots.create` | mutation | admin | Create a single slot |
| `slots.createBulk` | mutation | admin | Bulk create slots for a date range |
| `slots.setBlocked` | mutation | admin | Block or unblock a slot |
| `slots.delete` | mutation | admin | Delete a slot (cannot delete booked slots) |

### Bookings

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `bookings.create` | mutation | public | Create a new booking request |
| `bookings.uploadScreenshot` | mutation | public | Upload payment screenshot |
| `bookings.getByReference` | query | public | Look up booking by reference ID |
| `bookings.getByWhatsApp` | query | public | Look up bookings by WhatsApp number |
| `bookings.adminList` | query | admin | List all bookings (with status filter) |
| `bookings.todayBookings` | query | admin | Get today's bookings |
| `bookings.getById` | query | admin | Get full booking detail |
| `bookings.stats` | query | admin | Get booking counts by status |
| `bookings.confirm` | mutation | admin | Confirm a pending booking |
| `bookings.reject` | mutation | admin | Reject a pending booking |
| `bookings.cancel` | mutation | admin | Cancel a confirmed booking |

---

## Running Tests

```bash
pnpm test
```

The test suite covers booking creation, double-booking prevention, admin confirm/reject/cancel flows, role-based access control, stats aggregation, and auth logout.

---

*BestCricketAcademy V1 — Built for a single cricket facility in India.*
