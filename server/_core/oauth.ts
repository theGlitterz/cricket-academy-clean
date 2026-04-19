/**
 * server/_core/oauth.ts — Admin login route (self-hosted).
 *
 * Replaces Manus OAuth callback with a simple POST /api/auth/login endpoint.
 * Credentials are checked against ADMIN_EMAIL + ADMIN_PASSWORD env vars.
 * On success, a signed JWT session cookie is set.
 *
 * POST /api/auth/login  { email, password }  → sets session cookie, returns { ok: true }
 * POST /api/auth/logout                       → clears session cookie
 */

import type { Express } from "express";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { signSession } from "./sdk";
import { ENV } from "./env";
import { getUserByEmail, createUser } from "../db";
import bcrypt from "bcryptjs";

export function registerOAuthRoutes(app: Express) {
  // ── POST /api/auth/login ──────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Check credentials against env vars (primary admin account)
      const adminEmail = ENV.adminEmail;
      const adminPassword = ENV.adminPassword;

      if (!adminEmail || !adminPassword) {
        return res.status(500).json({
          error: "Admin credentials not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.",
        });
      }

      // Case-insensitive email comparison
      if (email.toLowerCase() !== adminEmail.toLowerCase()) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Password check — support both plain text (dev) and bcrypt hash (prod)
      let passwordValid = false;
      if (adminPassword.startsWith("$2")) {
        // bcrypt hash
        passwordValid = await bcrypt.compare(password, adminPassword);
      } else {
        // Plain text comparison (for initial setup / dev)
        passwordValid = password === adminPassword;
      }

      if (!passwordValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Ensure admin user exists in the database
      let user = await getUserByEmail(email.toLowerCase());
      if (!user) {
        const hash = await bcrypt.hash(password, 10);
        await createUser({
          email: email.toLowerCase(),
          passwordHash: hash,
          name: "Admin",
          role: "admin",
        });
        user = await getUserByEmail(email.toLowerCase());
      }

      if (!user) {
        return res.status(500).json({ error: "Failed to create user record" });
      }

      // Sign session JWT and set cookie
      const token = await signSession({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, cookieOptions);

      return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
      console.error("[Auth] Login error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/auth/logout ─────────────────────────────────────────────────
  app.post("/api/auth/logout", (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return res.json({ ok: true });
  });
}
