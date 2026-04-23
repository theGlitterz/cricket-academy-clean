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
  createBooking,
  createSlot,
  getAllBookings,
  getAllServices,
  getActiveServices,
  getAvailableSlots,
  getBookingByReference,
  getBookingById,
  getBookingStats,
  getBookingsByWhatsApp,
  getFacility,
  getServiceBySlug,
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
      const adminEmail = ENV.adminEmail;
      const adminPassword = ENV.adminPassword;
      const emailLower = input.email.toLowerCase();

      // ── Try DB user first (facility_admin and super_admin created via UI) ──
      const dbUser = await getUserByEmail(emailLower);
      if (dbUser && dbUser.passwordHash) {
        // Only allow admin roles to log in here
        if (dbUser.role !== "super_admin" && dbUser.role !== "facility_admin" && dbUser.role !== "admin") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        const passwordValid = await bcrypt.compare(input.password, dbUser.passwordHash);
        if (!passwordValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        // Sign JWT and set cookie
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

      // ── Fallback: env-based super admin (for first-time setup before seed) ──
      if (!adminEmail || !adminPassword) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      if (emailLower !== adminEmail.toLowerCase()) {
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
      // Ensure super_admin user record exists in DB
      let user = await getUserByEmail(emailLower);
      if (!user) {
        const hash = await bcrypt.hash(input.password, 10);
        await createUser({
          email: emailLower,
          passwordHash: hash,
          name: "Admin",
          role: "super_admin",
        });
        user = await getUserByEmail(emailLower);
      }
      if (!user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user record" });
      }
      const token = await signSession({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
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
  /** super_admin only: delete a facility — blocked if it has linked data */
  delete: superAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
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
      // Auto-confirm the booking now that screenshot is uploaded
      await db
        .update(bookings)
        .set({ bookingStatus: "confirmed", paymentStatus: "paid", updatedAt: new Date() })
        .where(eq(bookings.id, input.bookingId));
      // Notify owner that screenshot was uploaded
           // Notify owner that booking is confirmed
      notifyOwner({
        title: "Booking Confirmed",
        content: `${booking.playerName} has confirmed payment for booking ${booking.referenceId}. Slot is reserved.`,
      }).catch(() => {});


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
      })
    )
    .query(async ({ input }) => {
      return getAllBookings(FACILITY_ID, input.status);
    }),

  /** Admin: get booking stats */
  stats: adminProcedure.query(async () => {
    return getBookingStats(FACILITY_ID);
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

});

export type AppRouter = typeof appRouter;
