import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { uploadRoot } from "@/lib/org-logo-server";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await db.platformWebsiteSettings.findUnique({
      where: { id: "default" },
      select: { faviconPath: true, faviconData: true, faviconMime: true },
    });

    if (settings?.faviconData) {
      try {
        const buf = Buffer.from(settings.faviconData, "base64");
        return new NextResponse(buf, {
          headers: {
            "Content-Type": settings.faviconMime || "image/png",
            "Cache-Control": "public, max-age=0, must-revalidate",
          },
        });
      } catch {
        // fall through to disk
      }
    }

    if (!settings?.faviconPath) {
      return NextResponse.json({ error: "No favicon" }, { status: 404 });
    }

    const fullPath = path.join(uploadRoot(), settings.faviconPath);
    try {
      const data = await readFile(fullPath);
      const ext = path.extname(settings.faviconPath).toLowerCase();
      return new NextResponse(data, {
        headers: {
          "Content-Type": MIME[ext] || "image/png",
          "Cache-Control": "public, max-age=0, must-revalidate",
        },
      });
    } catch {
      return NextResponse.json({ error: "File missing" }, { status: 404 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/faviconData|faviconMime|faviconPath|Unknown column/i.test(message)) {
      return NextResponse.json({ error: "Favicon not configured" }, { status: 404 });
    }
    throw err;
  }
}
