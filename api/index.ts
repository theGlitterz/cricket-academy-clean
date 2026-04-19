/**
 * api/index.ts — Vercel serverless entry point.
 *
 * Wraps the Express app for deployment on Vercel.
 * All /api/* requests are routed here via vercel.json rewrites.
 *
 * Local dev: use `pnpm dev` (runs the full Express server with Vite HMR).
 * Production: Vercel runs this file as a serverless function.
 */
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

const app = express();

// Body parser with larger size limit for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Admin login / logout routes
registerOAuthRoutes(app);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
