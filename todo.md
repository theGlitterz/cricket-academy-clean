# BestCricketAcademy — Project TODO

## Prompt 1 of 5: Master Setup & Product Foundation

### Database Schema
- [x] Define `services` table (Ground Booking, Net Practice, Personal Coaching)
- [x] Define `slots` table (date, time, service, capacity, is_blocked)
- [x] Define `bookings` table (player info, slot, status, payment screenshot)
- [x] Define `facility_settings` table (UPI ID, QR code URL, facility name, contact)
- [x] Apply all migrations via drizzle-kit migrate

### Server / tRPC Routers
- [x] `services.list` — public, list all active services with pricing
- [x] `services.listAll` — admin, list all services including inactive
- [x] `slots.getAvailable` — public, get available slots for a service+date
- [x] `slots.getForRange` — admin, get slots for a date range
- [x] `slots.create` — admin, create a single slot
- [x] `slots.createBulk` — admin, bulk create standard schedule
- [x] `slots.setBlocked` — admin, block/unblock a slot
- [x] `bookings.create` — public, create a new booking request (pending)
- [x] `bookings.uploadPayment` — public, upload payment screenshot to S3
- [x] `bookings.getByReference` — public, get booking by reference ID
- [x] `bookings.getByWhatsApp` — public, get bookings by player WhatsApp
- [x] `bookings.adminList` — admin, list all bookings with status filter
- [x] `bookings.confirm` — admin, confirm a booking
- [x] `bookings.reject` — admin, reject a booking with optional note
- [x] `bookings.cancel` — admin, cancel a confirmed booking
- [x] `bookings.stats` — admin, booking stats (pending/confirmed/rejected/total)
- [x] `settings.get` — public, get facility settings
- [x] `settings.update` — admin, update facility settings
- [x] `settings.uploadQrCode` — admin, upload UPI QR code to S3

### UI — Player Side
- [x] Landing page with facility intro and 3 service cards (CTA to book)
- [x] BookingPage: 4-step flow (service → slot → details → payment → done)
- [x] Step indicator component
- [x] Date scroller (14-day picker)
- [x] Available slot grid with capacity display
- [x] Player details form (name, WhatsApp number)
- [x] Payment step: UPI QR display, UPI ID copy, screenshot upload
- [x] Done step with reference ID and status tracking link
- [x] BookingStatusPage: search by reference ID or WhatsApp number

### UI — Admin Side
- [x] AdminLayout: shared shell with sidebar nav (mobile hamburger + desktop sidebar)
- [x] AdminDashboard: stats cards, quick actions, pending bookings preview
- [x] AdminBookings: list with status filter tabs
- [x] AdminBookingDetail: player info, payment screenshot, confirm/reject/cancel actions
- [x] AdminSlots: single slot creation, bulk 10-slot schedule, block/unblock
- [x] AdminSettings: facility info, UPI ID, QR code upload, working hours

### UI — Theme & Layout
- [x] Cricket-inspired color palette (deep green, white, gold accents)
- [x] Mobile-first responsive layout
- [x] Custom global CSS variables and typography (Inter + Syne fonts)
- [x] Status badge CSS classes (pending/confirmed/rejected/cancelled)
- [x] Sidebar navigation for admin side

### Infrastructure & Config
- [x] README.md with setup, architecture, env vars, and deployment notes
- [x] seed.ts script for default services and facility settings
- [x] Vitest tests for core booking procedures (11 tests, all passing)
- [x] Vitest tests for admin confirm/reject/stats procedures

## Prompts 2–5 (Planned — Scope for Future Prompts)
- [x] Prompt 2: Data model, business logic, and booking rules — COMPLETE
- [x] Prompt 3: Player-facing mobile booking experience — COMPLETE
- [x] Prompt 4: Coach/Admin Panel — COMPLETE
- [x] Prompt 5: Final polish, end-to-end testing, README, and deployment prep — COMPLETE

## Prompt 2 of 5: Data Model, Business Logic & Booking Rules

### Schema Refinements
- [x] Add `facilities` table with id, facility_name, coach_name, coach_whatsapp_number, upi_id, upi_qr_image_url, address, working_hours, payment_instructions
- [x] Update `services` table: add facility_id FK, rename pricePerSlot → price, keep all existing fields
- [x] Update `slots` table: add facility_id FK, replace isBlocked+bookedCount with single availability_status enum (available/booked/blocked)
- [x] Update `bookings` table: add facility_id FK, add payment_status enum (pending_review/confirmed/rejected), rename status → booking_status, add booking_date, start_time, end_time denormalized columns
- [x] Apply migration SQL to database

### Booking Business Rules
- [x] Prevent double-booking: slot availability_status = 'booked' blocks new bookings for same slot
- [x] On booking create: set booking_status=pending, payment_status=pending_review, slot=booked
- [x] On coach confirm: set booking_status=confirmed, payment_status=confirmed, slot stays booked
- [x] On coach reject: set booking_status=rejected, payment_status=rejected, slot reverts to available
- [x] On cancel (confirmed booking): set booking_status=cancelled, slot reverts to available
- [x] Slot availability check before booking creation (race condition guard)

### Seed / Demo Data
- [x] Seed BestCricketAcademy facility record
- [x] Seed 3 services with realistic pricing and durations
- [x] Seed 14 days of time slots (6am–10am, 3pm–9pm) for all 3 services
- [x] Seed sample bookings in all statuses (pending, confirmed, rejected, cancelled)

### DB Helpers & Routers
- [x] Update all DB helpers to use new schema fields
- [x] Update tRPC routers to use facility_id in all queries
- [x] Ensure adminList returns denormalized slot date/time from booking record

### Frontend Updates
- [x] Update BookingPage to use new slot availability_status
- [x] Update AdminBookingDetail to show payment_status separately from booking_status
- [x] Update AdminDashboard stats to reflect new status fields

## Prompt 3 of 5: Player-Facing Mobile Booking Experience

### Landing Page
- [x] Hero section: facility name, tagline, dual CTA (Book a Session + Track Booking)
- [x] Info bar: working hours, WhatsApp, address
- [x] Service cards: Ground Booking, Net Practice, Personal Coaching with price/duration/CTA
- [x] How it works: 4-step visual guide
- [x] Footer with facility contact info

### Booking Flow (Multi-Step)
- [x] Step 1 — Service selection: card-based selection with price, duration, description
- [x] Step 2 — Date & slot: horizontal date scroller (14 days), slot grid with availability
- [x] Step 3 — Player details: name + WhatsApp form with validation
- [x] Step 4 — Payment: booking summary, UPI ID (copy), QR code, screenshot upload (mandatory)
- [x] Step 5 — Done: reference ID, status badge, WhatsApp share CTA
- [x] Step progress indicator (visual stepper)
- [x] Back navigation between steps
- [x] Cannot proceed without required selections/inputs
- [x] Phone number validation (10+ digits, Indian format)
- [x] Screenshot upload: mandatory, mobile gallery friendly, preview before submit

### Booking Status Page
- [x] Search by reference ID
- [x] Search by WhatsApp number
- [x] Status card: booking details, status badge, payment status
- [x] Clear empty/not-found state

### UX Polish
- [x] Large tap-friendly buttons (min 48px height)
- [x] Loading spinners on async actions
- [x] Error messages on failed API calls
- [x] Smooth step transitions
- [x] Mobile viewport meta and scroll behavior

## Prompt 4 of 5: Coach/Admin Panel

### Admin Login & Auth
- [x] Admin login page: clean OAuth-based login with role check, redirect to dashboard
- [x] AdminLayout: mobile hamburger menu + desktop sidebar, user info, logout
- [x] Role guard: non-admin users see "Access Denied" with contact info

### Admin Dashboard
- [x] Stats row: Today / Pending / Confirmed / Total counts (live from DB)
- [x] Today's bookings list: service, player, time, status badge, quick action
- [x] Pending review section: bookings awaiting payment confirmation
- [x] Quick action buttons: View All Bookings, Manage Slots

### Booking Management
- [x] AdminBookings: filterable list (All / Pending / Confirmed / Rejected / Cancelled)
- [x] Booking cards: player name, WhatsApp, service, date/time, amount, status badge
- [x] AdminBookingDetail: full booking info, payment screenshot preview (full-size tap)
- [x] Confirm action: single tap confirm with loading state
- [x] Reject action: reject with optional note (text input)
- [x] Cancel action: cancel confirmed booking
- [x] WhatsApp quick-contact link on each booking

### Slot Management
- [x] AdminSlots: view upcoming slots by service + date range
- [x] Create single slot: service, date, start time, end time
- [x] Bulk create: generate standard schedule (morning + evening) for N days
- [x] Block/unblock slot toggle
- [x] Slot status indicators: available / booked / blocked

### Facility Settings
- [x] Editable: facility name, coach name, coach WhatsApp, address, working hours
- [x] Editable: UPI ID (text field)
- [x] UPI QR code: upload image, preview current QR
- [x] Payment instructions text field
- [x] Save with success toast

### New Procedures Added
- [x] slots.getByDate — get all slots for a specific date and service
- [x] slots.delete — delete a slot (with guard: cannot delete booked slots)
- [x] bookings.getById — get full booking detail by ID (admin)
- [x] bookings.todayBookings — get all bookings for today (admin)
- [x] getAllBookings now joins services table to return serviceName

### Quality
- [x] TypeScript: 0 errors
- [x] All 20 tests passing

## Prompt 5 of 5: Polish, Code Quality & Export Readiness

### WhatsApp Utilities & Extension Points
- [x] Create `server/services/whatsapp.ts` — placeholder WhatsApp service with booking message generators
- [x] Add `WHATSAPP_API_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` to `.env.example` with comments
- [x] Add `// FUTURE: WhatsApp notification` comments at all booking lifecycle hooks (create, confirm, reject, cancel)
- [x] Add `// FUTURE: Multi-facility` comments at FACILITY_ID constant and all facility-scoped queries
- [x] Add `// FUTURE: Payment automation` comments at payment screenshot upload and booking confirm

### Code Quality
- [x] Create `shared/constants.ts` with FACILITY_ID, service slugs, status enums as typed constants
- [x] Create `client/src/lib/utils/booking.ts` — booking summary formatter for WhatsApp messages
- [x] Create `client/src/lib/utils/format.ts` — shared date/time/currency formatters
- [x] Ensure all admin pages use consistent status badge helper
- [x] Clean up unused imports across all files

### UI Polish
- [x] Consistent rounded-2xl card style across all pages
- [x] Consistent section heading typography (Syne font for all h1/h2)
- [x] Status badges: consistent pill style with correct colors across player and admin pages
- [x] Empty states: all list pages have friendly empty state messages
- [x] Loading skeletons on all data-fetching pages
- [x] Mobile: verify all tap targets are ≥48px height
- [x] Admin sidebar: active route highlight

### Documentation
- [x] Comprehensive README.md: local setup, DB setup, env vars, deployment, WhatsApp integration guide, facility settings guide
- [x] `.env.example` with all required and optional env vars (managed by platform)
- [x] Inline code comments at all major extension points

### Final Verification
- [x] Player can complete full booking flow end-to-end
- [x] Screenshot upload works and URL is saved to booking
- [x] Pending booking appears in admin dashboard
- [x] Admin can confirm booking → status updates to confirmed
- [x] Admin can reject booking → slot freed, status updates to rejected
- [x] Slot availability updates correctly (booked slot not shown as available)
- [x] TypeScript: 0 errors
- [x] All 20 tests passing

## Self-Hosting Refactor: Remove Manus Platform Dependencies

### Auth Replacement (Manus OAuth → Email + Password)
- [x] Create `server/auth.ts` — standalone JWT-based auth helpers (hash check, sign token, verify token)
- [x] Add `auth.adminLogin` tRPC procedure — checks ADMIN_EMAIL + ADMIN_PASSWORD env vars, issues JWT cookie
- [x] Update `auth.me` procedure — verify JWT cookie without Manus SDK
- [x] Update `auth.logout` procedure — clear cookie (already works, minor cleanup)
- [x] Replace `server/_core/context.ts` — remove Manus SDK dependency, use standalone JWT verify
- [x] Create `client/src/pages/admin/AdminLogin.tsx` — email + password login form
- [x] Update `client/src/pages/admin/AdminLayout.tsx` — redirect to `/admin/login` instead of Manus OAuth
- [x] Update `client/src/App.tsx` — add `/admin/login` route
- [x] Update `client/src/_core/hooks/useAuth.ts` — remove Manus localStorage key
- [x] Update `client/src/main.tsx` — redirect unauthorized to `/admin/login` not Manus OAuth
- [x] Update `client/src/const.ts` — remove Manus OAuth URL builder

### Storage Replacement (Manus S3 → Cloudinary)
- [x] Replace `server/storage.ts` — implement Cloudinary upload via REST API
- [x] Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` to env

### Database Layer
- [x] Update `drizzle/schema.ts` — simplify users table (remove openId, add email + passwordHash)
- [x] Update `server/db.ts` — replace `getUserByOpenId` with `getUserByEmail`
- [x] Run migration SQL for updated users table (0003_self_hosted_users.sql created)

### Documentation
- [x] Update `.env.example` — DEPLOYMENT.md created with full env var documentation
- [x] Update `README.md` — DEPLOYMENT.md created with Vercel + PlanetScale guide

### Tests
- [x] Update `server/bookings.test.ts` — update mocked user shape (remove openId)
- [x] Verify 20/20 tests still pass

## Neon PostgreSQL + Vercel Migration

- [x] Remove `mysql2`, install `@neondatabase/serverless` + `ws` + `@types/ws`
- [x] Update `drizzle/schema.ts` — `mysqlTable` → `pgTable`, `varchar` → `text`, `tinyint` → `boolean`, `serial` for IDs
- [x] Update `server/db.ts` — use Neon HTTP driver (`neon()` from `@neondatabase/serverless`)
- [x] Update `drizzle.config.ts` — dialect `mysql` → `postgresql`, add unpooled URL support
- [x] Write new PostgreSQL migration SQL (generate via drizzle-kit generate)
- [x] Add `vercel.json` — rewrite `/api/*` to serverless function
- [x] Add `api/index.ts` — Vercel serverless entry point wrapping Express
- [x] Update `package.json` — add `vercel-build` script
- [x] Update `DEPLOYMENT.md` — Neon + Vercel free stack guide
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (20/20)

## Bug Fixes

- [x] Remove broken `patchedDependencies` (wouter@3.7.1) from package.json so pnpm install works on Windows
- [x] Fix vercel.json so Vercel serves the React app correctly (not raw index.html text)
