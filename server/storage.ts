/**
 * server/storage.ts — File storage helpers using Cloudinary.
 *
 * Self-hosted replacement for the Manus built-in storage proxy.
 * Uses Cloudinary's REST API for image uploads (payment screenshots, QR codes).
 *
 * Required env vars:
 *   CLOUDINARY_CLOUD_NAME — your Cloudinary cloud name
 *   CLOUDINARY_API_KEY    — your Cloudinary API key
 *   CLOUDINARY_API_SECRET — your Cloudinary API secret
 *
 * Get free credentials at: https://cloudinary.com (free tier: 25 GB storage)
 */

import { createHash, createHmac } from "crypto";
import { ENV } from "./_core/env";

/**
 * Upload a file buffer to Cloudinary and return the public URL.
 *
 * @param relKey  - logical path used as the public_id (e.g. "payments/BCA-123.jpg")
 * @param data    - file content as Buffer, Uint8Array, or base64 string
 * @param contentType - MIME type (e.g. "image/jpeg")
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = ENV;

  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    throw new Error(
      "Cloudinary credentials missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET."
    );
  }

  // Convert data to base64 data URI for Cloudinary upload
  const base64Data =
    typeof data === "string"
      ? data
      : Buffer.isBuffer(data)
      ? data.toString("base64")
      : Buffer.from(data).toString("base64");

  const dataUri = `data:${contentType};base64,${base64Data}`;

  // Cloudinary public_id: strip extension from key
  const publicId = relKey.replace(/\.[^/.]+$/, "").replace(/^\/+/, "");

  // Build signed upload parameters
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHmac("sha256", cloudinaryApiSecret)
    .update(paramsToSign)
    .digest("hex");

  // POST to Cloudinary Upload API
  const formData = new FormData();
  formData.append("file", dataUri);
  formData.append("public_id", publicId);
  formData.append("timestamp", String(timestamp));
  formData.append("api_key", cloudinaryApiKey);
  formData.append("signature", signature);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Cloudinary upload failed (${response.status}): ${message}`);
  }

  const result = (await response.json()) as { secure_url: string; public_id: string };
  return { key: result.public_id, url: result.secure_url };
}

/**
 * Get the public URL for an already-uploaded file.
 * Cloudinary URLs are permanent and public — no signed URL needed.
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { cloudinaryCloudName } = ENV;
  if (!cloudinaryCloudName) {
    throw new Error("CLOUDINARY_CLOUD_NAME is not set.");
  }
  const key = relKey.replace(/^\/+/, "");
  const url = `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${key}`;
  return { key, url };
}
