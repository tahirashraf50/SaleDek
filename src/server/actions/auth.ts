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

export async function registerOrganization(formData: FormData) {
  const orgName = String(formData.get("orgName") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const planKey = (String(formData.get("plan") || "STARTER").toUpperCase() ||
    "STARTER") as SaaSPlanKey;

  if (!orgName || !name || !email || password.length < 6) {
    throw new Error("Please fill all fields (password min 6 chars).");
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already registered.");

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
        },
      },
    },
  });

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
    meta: { plan: plan?.key },
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/inbox",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error("Account created but login failed. Please sign in.");
    }
    throw error;
  }
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const user = await db.user.findUnique({
    where: { email },
    select: { role: true },
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: user?.role === "SUPER_ADMIN" ? "/admin" : "/inbox",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error("Invalid email or password.");
    }
    throw error;
  }
}

export async function logoutAction() {
  const { signOut } = await import("@/lib/auth");
  await signOut({ redirectTo: "/site" });
  redirect("/site");
}
