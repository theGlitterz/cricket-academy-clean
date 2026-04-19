/**
 * server/_core/env.ts — Environment variable definitions.
 * Self-hosted: uses standard env vars, no Manus platform dependencies.
 */
export const ENV = {
  /** JWT signing secret — set a long random string in production */
  cookieSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  /** MySQL/PostgreSQL connection string */
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Admin credentials — set these in your hosting provider's env settings */
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  /** Cloudinary credentials for file uploads (payment screenshots, QR codes) */
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  isProduction: process.env.NODE_ENV === "production",
};

// ─── Legacy Manus template fields (unused in self-hosted deployment) ──────────
// These are kept to prevent TypeScript errors in unused template files.
// They will be undefined in self-hosted deployments and those features will be disabled.
export const LEGACY_ENV = {
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  appId: process.env.VITE_APP_ID ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
};
