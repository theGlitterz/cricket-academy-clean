/**
 * client/src/const.ts — Frontend constants.
 * Self-hosted: no Manus OAuth dependencies.
 */

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Returns the admin login URL.
 * Self-hosted: always points to /admin/login.
 */
export function getLoginUrl(returnPath?: string): string {
  const base = "/admin/login";
  if (returnPath) {
    return `${base}?returnTo=${encodeURIComponent(returnPath)}`;
  }
  return base;
}
