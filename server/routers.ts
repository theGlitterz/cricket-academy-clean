/**
 * server/routers.ts — tRPC router for BestCricketAcademy
 *
 * Procedures are split into logical namespaces:
 *   facility  — public facility info + admin settings management
 *   services  — public service listing + admin CRUD
 *   slots     — public availability + admin slot management
 *   bookings  — public booking creation/lookup + admin review
 *   system    — health check
 *   auth      — login/logout/me (standalone JWT, no OAuth)
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import { signSession } from "./_core/sdk";
import { ENV } from "./_core/env";
import { buildCoachNewBookingAlert } from "./services/whatsapp";
import { sendCoachWhatsApp } from "./services/whatsappSender";
import {
  getUserByEmail,
  createUser,
  touchUserSignIn,
  createFacility,
  createFacilityAdmin,
  reassignFacilityAdmin,
  getFacilityAdmins,
  deleteFacilityAdmin,
  getAllFacilities,
} from "./db";
import bcrypt from "bcryptjs";
import Razorpay from "razorpay";
import { GROUND_BOOKING_SLUG, GROUND_SLOTS, getGroundSlotPricing } from "../shared/groundPricing";
import { services } from "../drizzle/schema";
import {
  getDb,
  FACILITY_ID,
  cancelBooking,
  confirmBooking,
  confirmBookingPaid,
  createBooking,
  createSlot,
  getAllBookings,
  getAllSlotsForDate,
  getAllServices,
  getActiveServices,
  getAvailableSlots,
  getAllSlotsForServiceAndDate,
  getBookingByReference,
  getBookingById,
  getBookingStats,
  getBookingsByWhatsApp,
  getFacility,
  getServiceBySlug,
  getServiceById,
  getSlotsForDateRange,
  getSlotById,
  rejectBooking,
  setSlotBlockStatus,
  updateBookingScreenshot,
  upsertFacility,
  upsertService,
  deleteSlot,
  deleteFacility,
  bulkDeleteSlots,
  deleteOpenSlotsForDate,
} from "./db";


// ─── Admin guard ──────────────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (
    !ctx.user ||
    (ctx.user.role !== "admin" &&
      ctx.user.role !== "super_admin" &&
      ctx.user.role !== "facility_admin")
  ) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});

const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "super_admin") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});

/**
 * Resolve the facilityId for the current admin user.
 * - super_admin  → returns FACILITY_ID (platform default)
 * - facility_admin / admin → returns their assigned facilityId
 *   Throws FORBIDDEN if no facilityId is assigned.
 */
function resolveFacilityId(user: { role: string; facilityId?: number | null }): number {
  if (user.role === "super_admin") return FACILITY_ID;
  const fid = user.facilityId;
  if (!fid) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is not assigned to a facility. Contact the platform admin.",
    });
  }
  return fid;
}

// ─── Auth router ──────────────────────────────────────────────────────────────

const authRouter = router({
  /**
   * Public: get current session user.
   * Returns null if not authenticated.
   */
  me: publicProcedure.query((opts) => opts.ctx.user ?? null),

  /**
   * Public: admin login with email + password.
   * Sets a JWT session cookie on success.
   */
  adminLogin: publicProcedure
    .input(
      z.object({
        email: z.string().email("Valid email required"),
        password: z.string().min(1, "Password is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const emailLower = input.email.toLowerCase();

      // ── 1. Try DB user first (facility_admin and super_admin created via UI) ──
      const dbUser = await getUserByEmail(emailLower);
      if (dbUser && dbUser.passwordHash) {
        console.log(`[adminLogin] email found: ${emailLower} | role: ${dbUser.role} | facilityId: ${dbUser.facilityId ?? "none"}`);
        if (dbUser.role !== "super_admin" && dbUser.role !== "facility_admin" && dbUser.role !== "admin") {
          console.log(`[adminLogin] access denied — role "${dbUser.role}" not permitted`);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        const passwordValid = await bcrypt.compare(input.password, dbUser.passwordHash);
        if (!passwordValid) {
          console.log(`[adminLogin] access denied — password mismatch for ${emailLower}`);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        console.log(`[adminLogin] access granted — role: ${dbUser.role}, facilityId: ${dbUser.facilityId ?? "none"}`);

        const token = await signSession({
          userId: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        touchUserSignIn(dbUser.id).catch(() => {});
        return { ok: true, user: { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role } };
      }

      // ── 2. Fallback: env-based super_admin (first-time setup before seed) ──
      const adminEmail = ENV.adminEmail;
      const adminPassword = ENV.adminPassword;
      if (!adminEmail || !adminPassword || emailLower !== adminEmail.toLowerCase()) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      let passwordValid = false;
      if (adminPassword.startsWith("$2")) {
        passwordValid = await bcrypt.compare(input.password, adminPassword);
      } else {
        passwordValid = input.password === adminPassword;
      }
      if (!passwordValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      // Auto-create DB record for env-based admin on first login
      let user = await getUserByEmail(emailLower);
      if (!user) {
        const hash = await bcrypt.hash(input.password, 10);
        await createUser({ email: emailLower, passwordHash: hash, name: "Admin", role: "super_admin" });
        user = await getUserByEmail(emailLower);
      }
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user record" });
      const token = await signSession({ userId: user.id, email: user.email, role: user.role });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
      touchUserSignIn(user.id).catch(() => {});
      return { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
    }),

  /**
   * Public: logout — clears the session cookie.
   */
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// ─── Facility router ──────────────────────────────────────────────────────────
const facilityRouter = router({
  /** Public: get facility info (name, contact, working hours) — always default facility */
  get: publicProcedure.query(async () => {
    return (await getFacility()) ?? null;
  }),

  /** Admin: get facility settings scoped to the logged-in user's facility */
  getForAdmin: adminProcedure.query(async ({ ctx }) => {
    const facilityId = resolveFacilityId(ctx.user!);
    console.log(`[facility.getForAdmin] user=${ctx.user!.email} facilityId=${facilityId}`);
    return (await getFacility(facilityId)) ?? null;
  }),

  /** Admin: update facility settings.
   *  super_admin must pass explicit `id` to target a specific facility.
   *  facility_admin/admin always use their own facilityId; `id` is ignored.
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.number().int().optional(),
        facilityName: z.string().min(1).optional(),
        coachName: z.string().optional(),
        coachWhatsApp: z.string().optional(),
        upiId: z.string().optional(),
        upiQrImageUrl: z.string().url().optional(),
        address: z.string().optional(),
        workingHours: z.string().optional(),
        paymentInstructions: z.string().optional(),
        googleMapsUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = ctx.user!;
      let facilityId: number;
      if (user.role === "super_admin") {
        if (!input.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "super_admin must provide a facility id to update." });
        }
        facilityId = input.id;
      } else {
        facilityId = resolveFacilityId(user);
      }
      console.log(`[facility.update] user=${user.email} role=${user.role} targeting facilityId=${facilityId}`);
      const { id: _ignored, ...data } = input;
      await upsertFacility(data, facilityId);
      return { success: true };
    }),

  /** Admin: upload UPI QR code image, returns CDN URL */
  uploadQrCode: adminProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        mimeType: z.string().default("image/png"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const facilityId = resolveFacilityId(ctx.user!);
      const buffer = Buffer.from(input.fileBase64, "base64");
      const ext = input.mimeType.split("/")[1] ?? "png";
      const key = `facility/upi-qr-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await upsertFacility({ upiQrImageUrl: url }, facilityId);
      return { url };
    }),

  /** super_admin only: list all facilities */
  listAll: superAdminProcedure.query(async () => {
    return getAllFacilities();
  }),

  /** super_admin only: create a new facility */
  create: superAdminProcedure
    .input(
      z.object({
        facilityName: z.string().min(1),
        coachName: z.string().optional(),
        coachWhatsApp: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createFacility(input);
      return { id };
    }),

  /** super_admin only: delete a facility (blocked if it has linked data) */
  delete: superAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      if (input.id === 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The primary facility cannot be deleted." });
      }
      await deleteFacility(input.id);
      return { success: true };
    }),
});


// ─── Services router ──────────────────────────────────────────────────────────

const servicesRouter = router({
  /** Public: list active services with price and duration */
  list: publicProcedure.query(async () => {
    return getActiveServices(FACILITY_ID);
  }),

  /** Admin: list all services including inactive — scoped to user's facility */
  listAll: adminProcedure.query(async ({ ctx }) => {
    return getAllServices(resolveFacilityId(ctx.user!));
  }),

  /** Admin: create or update a service — scoped to user's facility */
  upsert: adminProcedure
    .input(
      z.object({
        id: z.number().int().optional(),
        slug: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        durationMinutes: z.number().int().min(15),
        price: z.string(),
        advanceAmount: z.string().default("0"),
        activeStatus: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
      })
    )
       .mutation(async ({ input, ctx }) => {
      const facilityId = resolveFacilityId(ctx.user!);
      const isSuperAdmin = ctx.user!.role === "super_admin";
      // Only super_admin may set price/advance — facility_admin/admin changes are ignored
      const price = isSuperAdmin ? input.price : undefined;
      const advanceAmount = isSuperAdmin ? input.advanceAmount : undefined;
      if (price !== undefined && advanceAmount !== undefined) {
        const p = parseFloat(price);
        const a = parseFloat(advanceAmount);
        if (a > p) throw new TRPCError({ code: "BAD_REQUEST", message: "Advance amount cannot exceed the total price." });
      }
      await upsertService({
        ...input,
        facilityId,
        ...(price !== undefined ? { price, advanceAmount: advanceAmount ?? "0" } : {}),
      });
      return { success: true };
    }),

});

// ─── Slots router ─────────────────────────────────────────────────────────────

const slotsRouter = router({
  /**
   * Public: get available slots for a service on a given date.
   * Only returns slots with availabilityStatus='available'.
   */
   getAvailable: publicProcedure
    .input(
      z.object({
        serviceId: z.number().int(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ input }) => {
      // Returns all slots for the date (available + booked) so customers can
      // see ground activity. Frontend disables booked slots visually.
      return getAllSlotsForServiceAndDate(input.serviceId, input.date, FACILITY_ID);
    }),


  /** Admin: get all slots for a date range (all statuses) — scoped to user's facility */
  getForRange: adminProcedure
    .input(
      z.object({
        serviceId: z.number().int(),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ input, ctx }) => {
      return getSlotsForDateRange(input.serviceId, input.fromDate, input.toDate, resolveFacilityId(ctx.user!));
    }),

  /** Admin: create a single slot — scoped to user's facility */
  create: adminProcedure
    .input(
      z.object({
        serviceId: z.number().int(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        maxCapacity: z.number().int().min(1).default(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const service = await getServiceById(input.serviceId);
      const isGround = service?.slug === GROUND_BOOKING_SLUG;
      let slotPrice: number | undefined;
      let slotAdvance: number | undefined;
      if (isGround) {
        const pricing = getGroundSlotPricing(input.date, input.startTime);
        if (pricing) {
          slotPrice = pricing.price;
          slotAdvance = pricing.advance;
        }
      }
      const id = await createSlot({
        ...input,
        facilityId: resolveFacilityId(ctx.user!),
        ...(slotPrice != null ? { price: slotPrice, advanceAmount: slotAdvance } : {}),
      });
      return { id };
    }),


  /**
   * Admin: bulk create slots for a date range.
   * Generates a standard daily schedule for each day in the range.
   */
  createBulk: adminProcedure
    .input(
      z.object({
        serviceId: z.number().int(),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        timeSlots: z.array(
          z.object({
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
            endTime: z.string().regex(/^\d{2}:\d{2}$/),
          })
        ),
        maxCapacity: z.number().int().min(1).default(1),
      })
    )
       .mutation(async ({ input, ctx }) => {
      const fid = resolveFacilityId(ctx.user!);
      const service = await getServiceById(input.serviceId);
      const isGround = service?.slug === GROUND_BOOKING_SLUG;
      const from = new Date(input.fromDate);
      const to = new Date(input.toDate);
      let created = 0;
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const date = d.toISOString().slice(0, 10);
        // For Ground Booking: ignore timeSlots input, use fixed schedule with day-based pricing
        const slotsToCreate = isGround
          ? GROUND_SLOTS.map((s) => {
              const pricing = getGroundSlotPricing(date, s.startTime)!;
              return { startTime: s.startTime, endTime: s.endTime, price: pricing.price, advance: pricing.advance };
            })
          : input.timeSlots.map((s) => ({ ...s, price: undefined, advance: undefined }));
        for (const ts of slotsToCreate) {
          try {
            await createSlot({
              facilityId: fid,
              serviceId: input.serviceId,
              date,
              startTime: ts.startTime,
              endTime: ts.endTime,
              maxCapacity: input.maxCapacity,
              ...(ts.price != null ? { price: ts.price, advanceAmount: ts.advance } : {}),
            });
            created++;
          } catch {
            // Skip duplicates silently
          }
        }
      }
      return { created };
    }),

  /** Admin: get all slots for a single date across all services — scoped to user's facility */
  getByDate: adminProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input, ctx }) => {
      return getAllSlotsForDate(input.date, resolveFacilityId(ctx.user!));
    }),

  /**
   * Admin: block or unblock a slot.
   * Blocked slots cannot be booked.
   */
  setBlocked: adminProcedure
    .input(z.object({ id: z.number().int(), blocked: z.boolean() }))
    .mutation(async ({ input }) => {
      await setSlotBlockStatus(input.id, input.blocked);
      return { success: true };
    }),

  /** Admin: delete a slot (only if not booked). */
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await deleteSlot(input.id);
      return { success: true };
    }),

  /**
   * Admin: bulk delete selected slots by IDs.
   * Booked slots are skipped automatically.
   */
  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number().int()).min(1) }))
    .mutation(async ({ input }) => {
      return bulkDeleteSlots(input.ids);
    }),

  /**
   * Admin: delete all open (available/blocked) slots for a given date.
   * Booked slots are never deleted.
   */
  deleteAllOpenForDate: adminProcedure
    .input(z.object({ date: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return deleteOpenSlotsForDate(resolveFacilityId(ctx.user!), input.date);
    }),
});


// ─── Bookings router ──────────────────────────────────────────────────────────

const bookingsRouter = router({
  /**
   * Public: create a new booking.
   *
   * BOOKING RULES enforced in db.createBooking():
   * - Slot must be available (availabilityStatus='available')
   * - Slot is atomically marked 'booked' to prevent double-booking
   * - booking_status = 'pending', payment_status = 'pending_review'
   */
  create: publicProcedure
    .input(
      z.object({
        slotId: z.number().int(),
        serviceId: z.number().int(),
        playerName: z.string().min(1, "Name is required"),
        playerWhatsApp: z.string().min(10, "WhatsApp number is required"),
        playerEmail: z.string().email().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await createBooking({
          slotId: input.slotId,
          serviceId: input.serviceId,
          playerName: input.playerName,
          playerWhatsApp: input.playerWhatsApp,
          playerEmail: input.playerEmail,
          facilityId: FACILITY_ID,
        });

        // Notify coach of new booking (non-blocking)
        notifyOwner({
          title: "New Booking Request",
          content: `${input.playerName} (${input.playerWhatsApp}) has submitted a booking request. Reference: ${result.referenceId}`,
        }).catch(() => {});

        return result;
      } catch (error) {
        throw new TRPCError({
          code: "CONFLICT",
          message: error instanceof Error ? error.message : "Booking failed",
        });
      }
    }),

  /**
   * Public: upload payment screenshot for a booking.
   * Accepts base64-encoded image.
   */
  uploadPayment: publicProcedure
    .input(
      z.object({
        bookingId: z.number().int(),
        fileBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      })
    )
    .mutation(async ({ input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      if (booking.bookingStatus !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot upload screenshot for a non-pending booking" });
      }

      const buffer = Buffer.from(input.fileBase64, "base64");
      const ext = input.mimeType.split("/")[1] ?? "jpg";
      const key = `payments/${booking.referenceId}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      await updateBookingScreenshot(input.bookingId, url);
      await confirmBookingPaid(input.bookingId);

      // Notify owner in app/admin
      notifyOwner({
        title: "Booking Confirmed",
        content: `${booking.playerName} has confirmed payment for booking ${booking.referenceId}. Slot is reserved.`,
      }).catch(() => {});

      // Send WhatsApp to coach/sandbox recipients
      try {
        const service = await getServiceById(booking.serviceId);
        const facility = await getFacility();

        const message = buildCoachNewBookingAlert({
          playerName: booking.playerName,
          serviceName: service?.name ?? "Booking",
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          amount: Number(booking.amount),
          advance: Number(service?.advanceAmount ?? 0),
          remaining: Number(booking.amount) - Number(service?.advanceAmount ?? 0),
          referenceId: booking.referenceId,
          facilityName: facility?.facilityName ?? "Facility",
          coachWhatsApp: booking.playerWhatsApp,
        });

        await sendCoachWhatsApp(message);
      } catch (err) {
        console.error("WhatsApp notification failed:", err);
      }

      return { screenshotUrl: url };
    }),

  /** Public: look up a booking by reference ID */
  getByReference: publicProcedure
    .input(z.object({ referenceId: z.string() }))
    .query(async ({ input }) => {
      const booking = await getBookingByReference(input.referenceId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      return booking;
    }),

  /** Public: look up all bookings for a WhatsApp number */
  getByWhatsApp: publicProcedure
    .input(z.object({ playerWhatsApp: z.string().min(10) }))
    .query(async ({ input }) => {
      return getBookingsByWhatsApp(input.playerWhatsApp, FACILITY_ID);
    }),

  /** Admin: get today's bookings — scoped to user's facility */
  todayBookings: adminProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().split("T")[0];
    return getAllBookings(resolveFacilityId(ctx.user!), undefined, today);
  }),

  /** Admin: get a single booking by ID */
  getById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const booking = await getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      return booking;
    }),

  /** Admin: list all bookings with optional status filter — scoped to user's facility */
  adminList: adminProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "confirmed", "rejected", "cancelled"])
          .optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return getAllBookings(resolveFacilityId(ctx.user!), input.status, input.date);
    }),

  /** Admin: get booking stats — scoped to user's facility */
  stats: adminProcedure.query(async ({ ctx }) => {
    return getBookingStats(resolveFacilityId(ctx.user!));
  }),

  /** Admin: today-specific stats for dashboard — scoped to user's facility */
  todayStats: adminProcedure.query(async ({ ctx }) => {
    const fid = resolveFacilityId(ctx.user!);
    const today = new Date().toISOString().split("T")[0]!;
    const todayBs = await getAllBookings(fid, undefined, today);
    const confirmedToday = todayBs.filter((b) => b.bookingStatus === "confirmed");
    const advanceCollected = confirmedToday.reduce((sum, b) => sum + Number(b.advance ?? 0), 0);
    const todaySlots = await getAllSlotsForDate(today, fid);
    const openSlots = todaySlots.filter((s) => s.availabilityStatus === "available").length;
    const bookedSlots = todaySlots.filter((s) => s.availabilityStatus === "booked").length;
    return { advanceCollected, openSlots, bookedSlots, totalToday: todayBs.length };
  }),

  /**
   * Admin: confirm a booking.
   * BOOKING RULE: pending → confirmed; slot stays booked.
   */
  confirm: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        adminNote: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const booking = await getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      if (booking.bookingStatus !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot confirm a booking with status '${booking.bookingStatus}'`,
        });
      }
      await confirmBooking(input.id, ctx.user.id, input.adminNote);
      return { success: true };
    }),

  /**
   * Admin: reject a booking.
   * BOOKING RULE: pending → rejected; slot reverts to available.
   */
  reject: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        adminNote: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const booking = await getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      if (booking.bookingStatus !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot reject a booking with status '${booking.bookingStatus}'`,
        });
      }
      await rejectBooking(input.id, ctx.user.id, input.adminNote);
      return { success: true };
    }),

  /**
   * Admin: cancel a confirmed booking.
   * BOOKING RULE: confirmed → cancelled; slot reverts to available.
   */
  cancel: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        adminNote: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const booking = await getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      if (booking.bookingStatus !== "confirmed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot cancel a booking with status '${booking.bookingStatus}'`,
        });
      }
      await cancelBooking(input.id, ctx.user.id, input.adminNote);
      return { success: true };
    }),
});

// ─── Payments router ─────────────────────────────────────────────────────────

import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils";

function getRazorpay() {
  const keyId = ENV.razorpayKeyId;
  const keySecret = ENV.razorpayKeySecret;
  if (!keyId || !keySecret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Razorpay credentials are not configured on this server.",
    });
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

const paymentsRouter = router({
  createOrder: publicProcedure
    .input(
      z.object({
        serviceId: z.number().int(),
        slotId: z.number().int(),
      })
    )
    .mutation(async ({ input }) => {
      const keyId = ENV.razorpayKeyId;
      const keySecret = ENV.razorpayKeySecret;
      if (!keyId || !keySecret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Razorpay credentials are not configured" });
      }

      const service = await getServiceById(input.serviceId);
      if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });

      const slot = await getSlotById(input.slotId);
      if (!slot) throw new TRPCError({ code: "NOT_FOUND", message: "Slot not found" });
      if (slot.availabilityStatus !== "available") {
        throw new TRPCError({ code: "CONFLICT", message: "This slot is no longer available." });
      }

      // Use slot-level advance if stored; fallback to service advanceAmount; fallback to full price
      const slotAdvance = (slot as { advanceAmount?: number | null }).advanceAmount;
      const slotPrice = (slot as { price?: number | null }).price;
      let advanceInr: number;
      if (slotAdvance != null && slotAdvance > 0) {
        advanceInr = slotAdvance;
      } else if (slotPrice != null && slotPrice > 0) {
        // Slot has a price but no advance stored — compute 10%
        advanceInr = Math.round(slotPrice * 0.1);
      } else {
        const advanceRaw = (service as { advanceAmount?: string | null }).advanceAmount;
        advanceInr = advanceRaw && Number(advanceRaw) > 0 ? Number(advanceRaw) : Number(service.price);
      }
      console.log(`[createOrder] slotId=${input.slotId} slotPrice=${slotPrice ?? "null"} slotAdvance=${slotAdvance ?? "null"} advanceInr=${advanceInr}`);

      const amountPaise = Math.round(advanceInr * 100);

      if (amountPaise <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Advance amount must be greater than zero." });
      }

      const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const receipt = `adv-${input.slotId}-${Date.now()}`.slice(0, 40);

      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${credentials}`,
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt,
          notes: {
            serviceId: String(input.serviceId),
            slotId: String(input.slotId),
            serviceName: service.name,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Razorpay order creation failed: ${err}` });
      }

      const order = await response.json() as { id: string; amount: number; currency: string };
      return { orderId: order.id, amount: order.amount, currency: order.currency };
    }),

  verifyAndConfirmBooking: publicProcedure
    .input(
      z.object({
        slotId: z.number().int(),
        serviceId: z.number().int(),
        playerName: z.string().min(1),
        playerWhatsApp: z.string().min(10),
        playerEmail: z.string().email().optional(),
        razorpay_order_id: z.string(),
        razorpay_payment_id: z.string(),
        razorpay_signature: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const keySecret = ENV.razorpayKeySecret;
      if (!keySecret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Razorpay not configured." });
      }

      // Verify HMAC signature using Node built-in crypto
      const crypto = await import("crypto");
      const body = `${input.razorpay_order_id}|${input.razorpay_payment_id}`;
      const expectedSignature = crypto.createHmac("sha256", keySecret).update(body).digest("hex");
      if (expectedSignature !== input.razorpay_signature) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Payment verification failed. Booking not created." });
      }

      // Create booking
      let bookingResult: { id: number; referenceId: string };
      try {
        bookingResult = await createBooking({
          slotId: input.slotId,
          serviceId: input.serviceId,
          playerName: input.playerName,
          playerWhatsApp: input.playerWhatsApp,
          playerEmail: input.playerEmail,
          facilityId: FACILITY_ID,
        });
      } catch (err) {
        throw new TRPCError({
          code: "CONFLICT",
          message: err instanceof Error ? err.message : "Booking failed after payment.",
        });
      }

      // Immediately confirm
      await confirmBookingPaid(bookingResult.id, `Razorpay ${input.razorpay_payment_id}`);

      // Coach WhatsApp notification (Twilio — coach only, non-blocking)
      const facility = await getFacility();
      const service = await getServiceById(input.serviceId);
      const slot = await getSlotById(input.slotId);
      let coachWhatsAppUrl: string | null = null;
      if (facility?.coachWhatsApp) {
        // Use slot-level price/advance if stored; fallback to service values
        const slotPrice = (slot as { price?: number | null })?.price;
        const slotAdvance = (slot as { advanceAmount?: number | null })?.advanceAmount;
        const totalAmt = slotPrice != null && slotPrice > 0
          ? slotPrice
          : Number(service?.price ?? 0);
        const advanceAmt = slotAdvance != null && slotAdvance > 0
          ? slotAdvance
          : Number((service as { advanceAmount?: string | null }).advanceAmount ?? 0);
        console.log(`[Coach WA] amount=${totalAmt} advance=${advanceAmt} remaining=${totalAmt - advanceAmt} (slotPrice=${slotPrice ?? "null"} slotAdvance=${slotAdvance ?? "null"})`);
        const message = buildCoachNewBookingAlert({
          playerName: input.playerName,
          playerWhatsApp: input.playerWhatsApp,
          serviceName: service?.name ?? "Unknown",
          bookingDate: slot?.date ?? "",
          startTime: slot?.startTime ?? "",
          endTime: slot?.endTime ?? "",
          amount: totalAmt,
          advance: advanceAmt,
          remaining: totalAmt - advanceAmt,
          referenceId: bookingResult.referenceId,
          facilityName: facility.facilityName ?? "BestCricketAcademy",
          coachWhatsApp: facility.coachWhatsApp,
        });

        const maskedWa = input.playerWhatsApp.length > 4
          ? `****${input.playerWhatsApp.slice(-4)}`
          : "****";
        console.log(`[Coach WA] Sending booking alert. Player WA present: ${!!input.playerWhatsApp} (${maskedWa})`);

        await sendCoachWhatsApp(message, facility.coachWhatsApp);
        coachWhatsAppUrl = `https://wa.me/${facility.coachWhatsApp.replace(/\D/g, "")}`;
      }

      // Notify platform owner (non-blocking)
      notifyOwner({
        title: "New Booking Confirmed via Razorpay",
        content: `${input.playerName} (${input.playerWhatsApp}) paid advance. Reference: ${bookingResult.referenceId}`,
      }).catch(() => {});

      return {
        referenceId: bookingResult.referenceId,
        bookingId: bookingResult.id,
        coachWhatsAppUrl,
      };
    }),
});


// ─── Super Admin router ───────────────────────────────────────────────────────

const superAdminRouter = router({
  /** Super admin: list all services across all facilities */
  listAllServices: superAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: services.id,
        facilityId: services.facilityId,
        slug: services.slug,
        name: services.name,
        price: services.price,
        advanceAmount: services.advanceAmount,
        activeStatus: services.activeStatus,
      })
      .from(services)
      .orderBy(services.facilityId, services.sortOrder);
    return rows;
  }),
  /** Super admin: update price and advance for any service */
  updateServicePricing: superAdminProcedure
    .input(
      z.object({
        serviceId: z.number().int(),
        price: z.string(),
        advanceAmount: z.string().default("0"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const price = parseFloat(input.price);
      const advance = parseFloat(input.advanceAmount);
      if (isNaN(price) || price < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid price." });
      if (isNaN(advance) || advance < 0 || advance > price) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid advance amount." });
      await db.update(services).set({ price: input.price, advanceAmount: input.advanceAmount, updatedAt: new Date() }).where(eq(services.id, input.serviceId));
      console.log(`[superAdmin] Updated pricing for serviceId=${input.serviceId} price=${input.price} advance=${input.advanceAmount}`);
      return { success: true };
    }),
  createFacilityAdmin: superAdminProcedure

    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().min(8),
        facilityId: z.number().int(),
      })
    )
    .mutation(async ({ input }) => {
      const emailLower = input.email.toLowerCase();
      const existing = await getUserByEmail(emailLower);

      if (existing) {
        // Allow reassigning an existing facility_admin to a different facility
        const existingRole = (existing as { role: string }).role;
        if (existingRole !== "facility_admin" && existingRole !== "admin") {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A user with this email already exists with role "${existingRole}". Cannot reassign.`,
          });
        }
        // Reassign to new facility (no password change — existing password kept)
        await reassignFacilityAdmin(existing.id, input.facilityId);
        console.log(`[superAdmin] Reassigned existing user ${emailLower} (id=${existing.id}) to facilityId=${input.facilityId}`);
        return { success: true, reassigned: true };
      }

      const hash = await bcrypt.hash(input.password, 10);
      await createFacilityAdmin({
        email: emailLower,
        passwordHash: hash,
        name: input.name,
        facilityId: input.facilityId,
      });
      console.log(`[superAdmin] Created new facility_admin: ${emailLower} for facilityId=${input.facilityId}`);
      return { success: true, reassigned: false };
    }),

  listAdmins: superAdminProcedure.query(async () => {
    return getFacilityAdmins();
  }),

   removeAdmin: superAdminProcedure
    .input(z.object({ userId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      console.log(`[SuperAdmin] Delete facility admin requested: userId=${input.userId} by=${ctx.user!.email}`);
      await deleteFacilityAdmin(input.userId, ctx.user!.id);
      console.log(`[SuperAdmin] Delete facility admin success: userId=${input.userId}`);
      return { success: true };
    }),

});


// ─── App router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  facility: facilityRouter,
  services: servicesRouter,
  slots: slotsRouter,
  bookings: bookingsRouter,
  superAdmin: superAdminRouter,
  payments: paymentsRouter,
});

export type AppRouter = typeof appRouter;
