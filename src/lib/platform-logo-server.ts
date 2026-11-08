import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { uploadRoot } from "@/lib/org-logo-server";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

/** Save platform marketing logo under uploads/platform/branding/logo.{ext} */
export async function storePlatformLogo(file: File) {
  if (!file || !file.size) throw new Error("Logo file required");
  if (file.size > MAX_LOGO_BYTES) throw new Error("Logo max 2MB");
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime) && !mime.startsWith("image/")) {
    throw new Error("Logo must be an image (PNG, JPG, WEBP, SVG)");
  }

  const extFromName = path.extname(file.name).toLowerCase();
  const ext =
    extFromName && extFromName.length <= 5
      ? extFromName
      : mime === "image/png"
        ? ".png"
        : mime === "image/webp"
          ? ".webp"
          : mime === "image/svg+xml"
            ? ".svg"
            : mime === "image/gif"
              ? ".gif"
              : ".jpg";

  const relative = path.join("platform", "branding", `logo${ext}`);
  const fullPath = path.join(uploadRoot(), relative);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));
  return relative.split(path.sep).join("/");
}
