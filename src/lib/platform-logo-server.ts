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

const MAX_FAVICON_BYTES = 512 * 1024;
const FAVICON_ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/gif",
]);

export type StoredPlatformFavicon = {
  faviconPath: string;
  faviconMime: string;
  faviconData: string;
};

/** Read favicon into DB-safe base64 (Hostinger has no durable uploads disk). */
export async function storePlatformFavicon(
  file: File,
): Promise<StoredPlatformFavicon> {
  if (!file || !file.size) throw new Error("Favicon file required");
  if (file.size > MAX_FAVICON_BYTES) throw new Error("Favicon max 512KB");
  const mime = file.type || "application/octet-stream";
  const name = file.name.toLowerCase();
  const looksLikeIco = name.endsWith(".ico");
  if (
    !FAVICON_ALLOWED.has(mime) &&
    !mime.startsWith("image/") &&
    !looksLikeIco
  ) {
    throw new Error("Favicon must be PNG, ICO, SVG, JPG, or WEBP");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const resolvedMime =
    looksLikeIco && !mime.startsWith("image/")
      ? "image/x-icon"
      : mime.startsWith("image/")
        ? mime
        : "image/png";
  const ext =
    resolvedMime === "image/png"
      ? ".png"
      : resolvedMime === "image/webp"
        ? ".webp"
        : resolvedMime === "image/svg+xml"
          ? ".svg"
          : resolvedMime === "image/gif"
            ? ".gif"
            : resolvedMime.includes("icon")
              ? ".ico"
              : ".jpg";

  return {
    faviconPath: `platform/branding/favicon${ext}`,
    faviconMime: resolvedMime,
    faviconData: buffer.toString("base64"),
  };
}
