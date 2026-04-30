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
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import { signSession, verifySession } from "./_core/sdk";
import { ENV } from "./_core/env";
import { buildCoachNewBookingAlert } from "./services/whatsapp";
import { sendCoachWhatsApp } from "./services/whatsappSender";
import {
  getUserByEmail,
  createUser,
  touchUserSignIn,
  createFacility,
  createFacilityAdmin,
  getAllFacilities,
} from "./db";
import bcrypt from "bcryptjs";
import {
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
  getAllSlotsForDate,
  deleteSlot,
  deleteFacility,
  bulkDeleteSlots,
  deleteOpenSlotsForDate,
} from "./db";


// ─── Admin guard ──────────────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
 if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "super_admin")) {
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
        if (dbUser.role !== "super_admin" && dbUser.role !== "facility_admin" && dbUser.role !== "admin") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        const passwordValid = await bcrypt.compare(input.password, dbUser.passwordHash);
        if (!passwordValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
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
  /** Public: get facility info (name, contact, UPI, working hours) */
  get: publicProcedure.query(async () => {
    return (await getFacility()) ?? null;
  }),

  /** Admin: update facility settings */
  update: adminProcedure
    .input(
      z.object({
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
    .mutation(async ({ input }) => {
      await upsertFacility(input);
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
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const ext = input.mimeType.split("/")[1] ?? "png";
      const key = `facility/upi-qr-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await upsertFacility({ upiQrImageUrl: url });
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

  /** Admin: list all services including inactive */
  listAll: adminProcedure.query(async () => {
    return getAllServices(FACILITY_ID);
  }),

   /** Admin: create or update a service */
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
    .mutation(async ({ input }) => {
      const price = parseFloat(input.price);
      const advance = parseFloat(input.advanceAmount);
      if (advance > price) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Advance amount cannot exceed the total price.",
        });
      }
      await upsertService({
        ...input,
        facilityId: FACILITY_ID,
        price: input.price,
        advanceAmount: input.advanceAmount,
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
      return getAvailableSlots(input.serviceId, input.date, FACILITY_ID);
    }),

  /** Admin: get all slots for a date range (all statuses) */
  getForRange: adminProcedure
    .input(
      z.object({
        serviceId: z.number().int(),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ input }) => {
      return getSlotsForDateRange(input.serviceId, input.fromDate, input.toDate, FACILITY_ID);
    }),

  /** Admin: create a single slot */
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
    .mutation(async ({ input }) => {
      const id = await createSlot({ ...input, facilityId: FACILITY_ID });
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
    .mutation(async ({ input }) => {
      const from = new Date(input.fromDate);
      const to = new Date(input.toDate);
      let created = 0;

      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const date = d.toISOString().slice(0, 10);
        for (const ts of input.timeSlots) {
          try {
            await createSlot({
              facilityId: FACILITY_ID,
              serviceId: input.serviceId,
              date,
              startTime: ts.startTime,
              endTime: ts.endTime,
              maxCapacity: input.maxCapacity,
            });
            created++;
          } catch {
            // Skip duplicates silently
          }
        }
      }
      return { created };
    }),

  /**
   * Admin: get all slots for a single date across all services.
   */
  getByDate: adminProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input }) => {
      return getAllSlotsForDate(input.date, FACILITY_ID);
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
  /**
   * Admin: delete a slot (only if not booked).
   */
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
    .mutation(async ({ input }) => {
      return deleteOpenSlotsForDate(FACILITY_ID, input.date);
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

  /** Admin: get today's bookings */
  todayBookings: adminProcedure.query(async () => {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return getAllBookings(FACILITY_ID, undefined, today);
  }),
  /** Admin: get a single booking by ID */
  getById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const booking = await getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      return booking;
    }),
  /** Admin: list all bookings with optional status filter */
  adminList: adminProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "confirmed", "rejected", "cancelled"])
          .optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
      })
    )
    .query(async ({ input }) => {
      return getAllBookings(FACILITY_ID, input.status, input.date);
    }),


  /** Admin: get booking stats */
  stats: adminProcedure.query(async () => {
    return getBookingStats(FACILITY_ID);
  }),
  /** Admin: today-specific stats for dashboard */
  todayStats: adminProcedure.query(async () => {
    const today = new Date().toISOString().split("T")[0]!;
    const todayBs = await getAllBookings(FACILITY_ID, undefined, today);
    const confirmedToday = todayBs.filter((b) => b.bookingStatus === "confirmed");
    const advanceCollected = confirmedToday.reduce((sum, b) => sum + Number(b.advance ?? 0), 0);
    // Count available slots for today
    const todaySlots = await getAllSlotsForDate(today, FACILITY_ID);
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
      // FUTURE: WhatsApp notification — send booking confirmed message to player
      // const msg = buildBookingConfirmedMessage({ playerName: booking.playerName, ... });
      // await sendWhatsAppMessage(booking.playerWhatsApp, msg);
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
      // FUTURE: WhatsApp notification — send booking rejected message to player
      // const msg = buildBookingRejectedMessage({ playerName: booking.playerName, ... }, input.adminNote);
      // await sendWhatsAppMessage(booking.playerWhatsApp, msg);
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
      // FUTURE: WhatsApp notification — send booking cancelled message to player
      // const msg = buildBookingCancelledMessage({ playerName: booking.playerName, ... });
      // await sendWhatsAppMessage(booking.playerWhatsApp, msg);
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

      const advanceRaw = (service as { advanceAmount?: string | null }).advanceAmount;
      const advanceInr = advanceRaw && Number(advanceRaw) > 0 ? Number(advanceRaw) : Number(service.price);
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
            serviceId: String(input.serviceId ),
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
        const message = buildCoachNewBookingAlert({
          playerName: input.playerName,
          serviceName: service?.name ?? "Unknown",
          bookingDate: slot?.date ?? "",
          startTime: slot?.startTime ?? "",
          endTime: slot?.endTime ?? "",
          amount: Number(service?.price ?? 0),
          advance: Number((service as { advanceAmount?: string | null }).advanceAmount ?? 0),
          remaining: Number(service?.price ?? 0) - Number((service as { advanceAmount?: string | null }).advanceAmount ?? 0),
          referenceId: bookingResult.referenceId,
          facilityName: facility.facilityName ?? "BestCricketAcademy",
          coachWhatsApp: facility.coachWhatsApp,
        });
        // sendCoachWhatsApp handles all error logging internally and never throws
        await sendCoachWhatsApp(message, facility.coachWhatsApp);
        coachWhatsAppUrl = `https://wa.me/${facility.coachWhatsApp.replace(/\D/g, "" )}`;
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



// ─── App router ───────────────────────────────────────────────────────────────
const superAdminRouter = router({
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
      const existing = await getUserByEmail(input.email.toLowerCase());
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A user with this email already exists" });
      }
      const hash = await bcrypt.hash(input.password, 10);
      await createFacilityAdmin({
        email: input.email.toLowerCase(),
        passwordHash: hash,
        name: input.name,
        facilityId: input.facilityId,
      });
      return { success: true };
    }),
});

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
