/**
 * server/_core/sdk.ts — Standalone JWT auth service.
 *
 * Self-hosted replacement for the Manus OAuth SDK.
 * Admin login uses email + password credentials stored in environment variables.
 * Sessions are signed JWT cookies (HS256, 1 year expiry).
 *
 * Environment variables required:
 *   ADMIN_EMAIL    — admin login email (set in your hosting env)
 *   ADMIN_PASSWORD — admin login password (set in your hosting env)
 *   JWT_SECRET     — secret used to sign session cookies
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { ForbiddenError } from "@shared/_core/errors";

// ─── Session payload ──────────────────────────────────────────────────────────

export type SessionPayload = {
  userId: number;
  email: string;
  role: string;
};

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function getSecretKey(): Uint8Array {
  const secret = ENV.cookieSecret || "change-me-in-production";
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: SessionPayload,
  options: { expiresInMs?: number } = {}
): Promise<string> {
  const issuedAt = Date.now();
  const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
  const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecretKey());
}

export async function verifySession(
  cookieValue: string | undefined | null
): Promise<SessionPayload | null> {
  if (!cookieValue) return null;

  try {
    const { payload } = await jwtVerify(cookieValue, getSecretKey(), {
      algorithms: ["HS256"],
    });

    const { userId, email, role } = payload as Record<string, unknown>;

    if (
      typeof userId !== "number" ||
      typeof email !== "string" ||
      typeof role !== "string"
    ) {
      return null;
    }

    return { userId, email, role };
  } catch {
    return null;
  }
}

// ─── Request authentication ───────────────────────────────────────────────────

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  if (!cookieHeader) return new Map();
  return new Map(Object.entries(parseCookieHeader(cookieHeader)));
}

/**
 * Authenticate an incoming Express request by verifying its session cookie.
 * Returns the User record from the database, or throws ForbiddenError.
 */
export async function authenticateRequest(req: Request): Promise<User> {
  const cookies = parseCookies(req.headers.cookie);
  const sessionCookie = cookies.get(COOKIE_NAME);
  const session = await verifySession(sessionCookie);

  if (!session) {
    throw ForbiddenError("Invalid or missing session cookie");
  }

  const user = await db.getUserByEmail(session.email);

  if (!user) {
    throw ForbiddenError("User not found");
  }

  // Update last signed in (non-blocking)
  db.touchUserSignIn(user.id).catch(() => {});

  return user;
}

// ─── Compatibility export ─────────────────────────────────────────────────────

/** Named export for backward compatibility with context.ts */
export const sdk = {
  authenticateRequest,
};
