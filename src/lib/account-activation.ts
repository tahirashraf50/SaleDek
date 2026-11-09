import { randomBytes } from "crypto";
import { addHours } from "date-fns";
import { db } from "@/lib/db";
import { PLATFORM_NAME, sendPlatformEmail } from "@/lib/platform-email";

const TOKEN_HOURS = 48;

export function appBaseUrl() {
  return (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://saledek.com"
  ).replace(/\/$/, "");
}

export function newActivationToken() {
  return randomBytes(32).toString("hex");
}

export async function ensureUserActivationColumns() {
  for (const sql of [
    "ALTER TABLE `User` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL",
    "ALTER TABLE `User` ADD COLUMN `activationToken` VARCHAR(191) NULL",
    "ALTER TABLE `User` ADD COLUMN `activationExpiresAt` DATETIME(3) NULL",
  ]) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/Duplicate column|already exists/i.test(message)) {
        /* ignore */
      }
    }
  }
  try {
    await db.$executeRawUnsafe(
      "CREATE UNIQUE INDEX `User_activationToken_key` ON `User`(`activationToken`)",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/Duplicate|already exists/i.test(message)) {
      /* ignore */
    }
  }
}

/** Mark user inactive + store token, then email the activation link. */
export async function issueActivationEmail(input: {
  userId: string;
  email: string;
  name: string;
  orgName: string;
}) {
  const token = newActivationToken();
  const activationExpiresAt = addHours(new Date(), TOKEN_HOURS);

  try {
    await db.user.update({
      where: { id: input.userId },
      data: {
        active: false,
        emailVerifiedAt: null,
        activationToken: token,
        activationExpiresAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/activationToken|emailVerifiedAt|activationExpiresAt|Unknown column/i.test(message)) {
      await ensureUserActivationColumns();
      await db.user.update({
        where: { id: input.userId },
        data: {
          active: false,
          emailVerifiedAt: null,
          activationToken: token,
          activationExpiresAt,
        },
      });
    } else {
      throw err;
    }
  }

  const link = `${appBaseUrl()}/activate?token=${encodeURIComponent(token)}`;
  const subject = `Activate your ${PLATFORM_NAME} workspace`;
  const body = [
    `Hi ${input.name},`,
    ``,
    `Thanks for creating “${input.orgName}” on ${PLATFORM_NAME}.`,
    `Confirm your work email to enable your account:`,
    ``,
    link,
    ``,
    `This link expires in ${TOKEN_HOURS} hours.`,
    `If you did not sign up, you can ignore this email.`,
    ``,
    `— ${PLATFORM_NAME}`,
  ].join("\n");

  const result = await sendPlatformEmail(input.email, subject, body);
  if (result.mode !== "LIVE") {
    console.info(
      `[activation] MOCK email to ${input.email} — open: ${link}`,
    );
  }
  return { ...result, link, token };
}

export async function activateAccountByToken(token: string) {
  const clean = token.trim();
  if (!clean) return { ok: false as const, error: "Missing activation link." };

  let user;
  try {
    user = await db.user.findFirst({
      where: { activationToken: clean },
      include: { organization: { select: { name: true } } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/activationToken|Unknown column/i.test(message)) {
      await ensureUserActivationColumns();
      user = await db.user.findFirst({
        where: { activationToken: clean },
        include: { organization: { select: { name: true } } },
      });
    } else {
      throw err;
    }
  }

  if (!user) return { ok: false as const, error: "Invalid or already used activation link." };
  if (user.activationExpiresAt && user.activationExpiresAt < new Date()) {
    return { ok: false as const, error: "Activation link expired. Sign up again or contact support." };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      active: true,
      emailVerifiedAt: new Date(),
      activationToken: null,
      activationExpiresAt: null,
    },
  });

  return {
    ok: true as const,
    email: user.email,
    name: user.name,
    orgName: user.organization?.name || null,
  };
}
