const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

export type StoredPlatformLogo = {
  /** Relative path kept for backwards compatibility */
  logoPath: string;
  logoMime: string;
  /** Base64 payload stored in DB so Hostinger deploys don't wipe the file */
  logoData: string;
};

/** Read logo into DB-safe base64 (Hostinger has no durable uploads disk). */
export async function storePlatformLogo(file: File): Promise<StoredPlatformLogo> {
  if (!file || !file.size) throw new Error("Logo file required");
  if (file.size > MAX_LOGO_BYTES) throw new Error("Logo max 2MB");
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime) && !mime.startsWith("image/")) {
    throw new Error("Logo must be an image (PNG, JPG, WEBP, SVG)");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext =
    mime === "image/png"
      ? ".png"
      : mime === "image/webp"
        ? ".webp"
        : mime === "image/svg+xml"
          ? ".svg"
          : mime === "image/gif"
            ? ".gif"
            : ".jpg";

  return {
    logoPath: `platform/branding/logo${ext}`,
    logoMime: mime.startsWith("image/") ? mime : "image/png",
    logoData: buffer.toString("base64"),
  };
}
