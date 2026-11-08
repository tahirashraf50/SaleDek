import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ messageId: string }> }
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messageId } = await ctx.params;
  const message = await db.message.findFirst({
    where: { id: messageId },
    include: {
      conversation: { select: { organizationId: true } },
    },
  });

  if (!message || message.conversation.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const meta =
    message.meta && typeof message.meta === "object"
      ? (message.meta as Record<string, unknown>)
      : {};
  const filePath = typeof meta.filePath === "string" ? meta.filePath : null;
  if (!filePath) {
    return NextResponse.json({ error: "No media" }, { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type":
          (typeof meta.mimeType === "string" && meta.mimeType) ||
          "application/octet-stream",
        "Content-Disposition": `inline; filename="${
          (typeof meta.fileName === "string" && meta.fileName) || "media"
        }"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
