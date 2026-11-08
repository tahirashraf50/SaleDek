import { NextRequest, NextResponse } from "next/server";
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
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await ctx.params;
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
    select: { logoPath: true },
  });
  if (!org?.logoPath) {
    return NextResponse.json({ error: "No logo" }, { status: 404 });
  }

  const fullPath = path.join(uploadRoot(), org.logoPath);
  try {
    const data = await readFile(fullPath);
    const ext = path.extname(org.logoPath).toLowerCase();
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME[ext] || "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
