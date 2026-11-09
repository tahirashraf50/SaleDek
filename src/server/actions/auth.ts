"use server";

import bcrypt from "bcryptjs";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { seedOrganizationDefaults } from "@/lib/org-defaults";
import { slugify } from "@/lib/utils";
import { writeAudit } from "@/lib/audit";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { SaaSPlanKey } from "@prisma/client";
import { assertBusinessEmail } from "@/lib/business-email";
import {
  ensureUserActivationColumns,
  issueActivationEmail,
} from "@/lib/account-activation";

export type RegisterState = { error?: string; ok?: boolean };

export async function registerOrganization(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const orgName = String(formData.get("orgName") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const planKey = (String(formData.get("plan") || "STARTER").toUpperCase() ||
    "STARTER") as SaaSPlanKey;

  if (!orgName || !name || !email || password.length < 6) {
    return { error: "Please fill all fields (password min 6 chars)." };
  }

  const businessError = assertBusinessEmail(email);
  if (businessError) return { error: businessError };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "Email already registered." };

  let slug = slugify(orgName) || "org";
  const slugTaken = await db.organization.findUnique({ where: { slug } });
  if (slugTaken) slug = `${slug}-${Date.now().toString(36)}`;

  const plan =
    (await db.saaSPlan.findUnique({ where: { key: planKey } })) ||
    (await db.saaSPlan.findUnique({ where: { key: "DEMO" } })) ||
    (await db.saaSPlan.findUnique({ where: { key: "STARTER" } }));

  const passwordHash = await bcrypt.hash(password, 10);
  const trialDays = plan?.trialDays && plan.trialDays > 0 ? plan.trialDays : 14;
  const trialEndsAt = addDays(new Date(), trialDays);

  let userId = "";
  try {
    const org = await db.organization.create({
      data: {
        name: orgName,
        slug,
        status: "TRIAL",
        planId: plan?.id,
        trialEndsAt,
        users: {
          create: {
            email,
            name,
            passwordHash,
            role: "ORG_ADMIN",
            active: false,
          },
        },
      },
      include: { users: { where: { email }, take: 1 } },
    });

    userId = org.users[0]?.id || "";
    if (!userId) {
      const created = await db.user.findUnique({ where: { email } });
      userId = created?.id || "";
    }

    if (plan) {
      await db.orgSubscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: "TRIAL",
          startedAt: new Date(),
          endsAt: trialEndsAt,
          renewsAt: trialEndsAt,
        },
      });
    }

    await seedOrganizationDefaults(db, org.id);
    await writeAudit({
      organizationId: org.id,
      action: "org.registered",
      entity: "Organization",
      entityId: org.id,
      meta: { plan: plan?.key, pendingActivation: true },
    });

    if (userId) {
      await issueActivationEmail({
        userId,
        email,
        name,
        orgName,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/emailVerifiedAt|activationToken|Unknown column/i.test(message)) {
      await ensureUserActivationColumns();
      return {
        error: "Account schema updated — please submit signup again.",
      };
    }
    console.error("[registerOrganization]", err);
    return { error: "Signup failed. Try again." };
  }

  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export type LoginState = { error?: string };

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Enter email and password." };
  }

  let redirectTo = "/inbox";
  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { role: true, active: true },
    });
    if (user && !user.active) {
      return {
        error:
          "Activate your account first — check your work email for the link, or use Resend on the check-email page.",
      };
    }
    if (user?.role === "SUPER_ADMIN") redirectTo = "/admin";
  } catch (err) {
    console.error("[loginAction] database error:", err);
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "P1001") {
      return {
        error:
          "Cannot reach MySQL (P1001). Set DATABASE_URL host to 127.0.0.1 on Hostinger.",
      };
    }
    if (code === "P1000" || code === "P1010") {
      return {
        error:
          "MySQL login failed (bad user/password). Encode @ in password as %40.",
      };
    }
    if (code === "P2021") {
      return {
        error: "Database tables missing (P2021). Redeploy so migrations can run.",
      };
    }
    return {
      error: `Database is not ready${code ? ` (${code})` : ""}. Open /api/health then redeploy.`,
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
    return {};
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    console.error("[loginAction] unexpected:", error);
    return { error: "Sign-in failed. Check AUTH_SECRET and try again." };
  }
}

export async function logoutAction() {
  const { signOut } = await import("@/lib/auth");
  await signOut({ redirectTo: "/" });
  redirect("/");
}

export async function resendActivationEmail(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { error: "Email required." };

  const user = await db.user.findUnique({
    where: { email },
    include: { organization: { select: { name: true } } },
  });
  if (!user) return { error: "No account found for that email." };
  if (user.active && user.emailVerifiedAt) {
    return { error: "Account is already activated. You can sign in." };
  }

  await issueActivationEmail({
    userId: user.id,
    email: user.email,
    name: user.name,
    orgName: user.organization?.name || "your workspace",
  });

  return { ok: true };
}
