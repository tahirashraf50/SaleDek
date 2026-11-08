"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { writeAudit } from "@/lib/audit";
import { parseOrderFormValues } from "@/lib/product-form";
import { CustomerStatus } from "@prisma/client";

export async function listCompaniesLite() {
  const session = await requirePerm("customers:read");
  return db.company.findMany({
    where: { organizationId: session.organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}

function normalizeCnic(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnic(digits: string) {
  if (digits.length !== 13) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/** Lookup an existing customer by CNIC / ID card number. */
export async function findCustomerByCnic(cnic: string) {
  const session = await requirePerm("customers:read");
  const raw = cnic.trim();
  const digits = normalizeCnic(raw);
  if (digits.length < 5) return null;

  const variants = Array.from(
    new Set([raw, digits, formatCnic(digits)].filter(Boolean))
  );

  const customer = await db.customer.findFirst({
    where: {
      organizationId: session.organizationId,
      OR: variants.map((v) => ({ cnic: v })),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      cnic: true,
      city: true,
      address: true,
      source: true,
      status: true,
      companyId: true,
      customData: true,
      company: { select: { id: true, name: true } },
    },
  });

  if (customer) return customer;

  // Fallback: digit-normalized match among recent CNIC records
  const recent = await db.customer.findMany({
    where: {
      organizationId: session.organizationId,
      cnic: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      cnic: true,
      city: true,
      address: true,
      source: true,
      status: true,
      companyId: true,
      customData: true,
      company: { select: { id: true, name: true } },
    },
  });

  return (
    recent.find((c) => normalizeCnic(c.cnic || "") === digits) || null
  );
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
  cnic?: string;
  address?: string;
  city?: string;
  source?: string;
  companyId?: string;
  newCompanyName?: string;
  jobTitle?: string;
  status?: CustomerStatus;
}) {
  const session = await requirePerm("customers:write");
  const organizationId = session.organizationId;

  let companyId = data.companyId || null;
  if (data.newCompanyName?.trim()) {
    const company = await db.company.create({
      data: {
        organizationId,
        name: data.newCompanyName.trim(),
      },
    });
    companyId = company.id;
  }

  const customData = data.jobTitle?.trim()
    ? { jobTitle: data.jobTitle.trim() }
    : undefined;

  const customer = await db.customer.create({
    data: {
      organizationId,
      name: data.name.trim(),
      phone: data.phone || null,
      email: data.email || null,
      cnic: data.cnic || null,
      address: data.address || null,
      city: data.city || null,
      source: data.source || null,
      companyId,
      status: data.status || "LEAD",
      ownerId: session.user.id,
      ...(customData ? { customData } : {}),
    },
  });

  await logActivity({
    organizationId,
    userId: session.user.id,
    customerId: customer.id,
    type: "SYSTEM",
    title: `Customer ${customer.name} created`,
  });
  await writeAudit({
    organizationId,
    userId: session.user.id,
    action: "customer.create",
    entity: "Customer",
    entityId: customer.id,
  });

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return customer;
}

export async function updateCustomer(
  id: string,
  data: Partial<{
    name: string;
    phone: string;
    email: string;
    cnic: string;
    address: string;
    city: string;
    source: string;
    status: CustomerStatus;
    companyId: string | null;
    jobTitle: string | null;
    newCompanyName: string | null;
  }>
) {
  const session = await requirePerm("customers:write");
  const organizationId = session.organizationId;

  const existing = await db.customer.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw new Error("Customer not found");

  let companyId =
    data.companyId === undefined ? undefined : data.companyId || null;

  if (data.newCompanyName?.trim()) {
    const company = await db.company.create({
      data: {
        organizationId,
        name: data.newCompanyName.trim(),
      },
    });
    companyId = company.id;
  }

  const prevCustom =
    existing.customData && typeof existing.customData === "object"
      ? (existing.customData as Record<string, unknown>)
      : {};

  const nextCustom = { ...prevCustom };
  if (data.jobTitle !== undefined) {
    if (data.jobTitle?.trim()) nextCustom.jobTitle = data.jobTitle.trim();
    else delete nextCustom.jobTitle;
  }

  const customer = await db.customer.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.cnic !== undefined ? { cnic: data.cnic || null } : {}),
      ...(data.address !== undefined ? { address: data.address || null } : {}),
      ...(data.city !== undefined ? { city: data.city || null } : {}),
      ...(data.source !== undefined ? { source: data.source || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(companyId !== undefined ? { companyId } : {}),
      customData: nextCustom,
    },
  });

  await logActivity({
    organizationId,
    userId: session.user.id,
    customerId: id,
    type: "SYSTEM",
    title: `Customer ${customer.name} updated`,
  });

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  revalidatePath("/inbox");
  return customer;
}

export async function addCustomerNote(customerId: string, body: string) {
  const session = await requirePerm("customers:write");
  const customer = await db.customer.findFirst({
    where: { id: customerId, organizationId: session.organizationId },
  });
  if (!customer) throw new Error("Not found");

  const note = await db.note.create({
    data: {
      customerId,
      body,
      createdBy: session.user.id,
    },
  });

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId,
    type: "NOTE",
    title: "Note added",
    body,
  });

  revalidatePath(`/customers/${customerId}`);
  return note;
}

export async function createCompany(data: {
  name: string;
  ntn?: string;
  strn?: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  notes?: string;
}) {
  const session = await requirePerm("customers:write");
  const company = await db.company.create({
    data: {
      organizationId: session.organizationId,
      name: data.name,
      ntn: data.ntn || null,
      strn: data.strn || null,
      industry: data.industry || null,
      website: data.website || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      postalCode: data.postalCode || null,
      notes: data.notes || null,
    },
  });
  revalidatePath("/companies");
  return company;
}

export async function updateCompany(
  companyId: string,
  data: {
    name: string;
    ntn?: string | null;
    strn?: string | null;
    industry?: string | null;
    website?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    notes?: string | null;
  }
) {
  const session = await requirePerm("customers:write");
  const existing = await db.company.findFirst({
    where: { id: companyId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!existing) throw new Error("Company not found");

  const company = await db.company.update({
    where: { id: companyId },
    data: {
      name: data.name.trim(),
      ntn: data.ntn?.trim() || null,
      strn: data.strn?.trim() || null,
      industry: data.industry?.trim() || null,
      website: data.website?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      postalCode: data.postalCode?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });

  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
  return company;
}

export async function getCustomerProfile(customerId: string) {
  const session = await requirePerm("customers:read");
  const organizationId = session.organizationId;

  const [customer, companies] = await Promise.all([
    db.customer.findFirst({
      where: { id: customerId, organizationId },
      include: {
        company: { select: { id: true, name: true } },
        tickets: {
          orderBy: { createdAt: "desc" },
          take: 12,
          include: { stage: { select: { name: true } } },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { items: true },
        },
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 10,
          include: {
            messages: { orderBy: { sentAt: "desc" }, take: 1 },
          },
        },
        deals: {
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: { stage: { select: { name: true } } },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 12,
          include: { user: { select: { name: true } } },
        },
        attachments: {
          where: { ticketId: null },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    }),
    db.company.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  if (!customer) throw new Error("Customer not found");

  const custom =
    customer.customData && typeof customer.customData === "object"
      ? (customer.customData as Record<string, unknown>)
      : {};

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    cnic: customer.cnic,
    address: customer.address,
    city: customer.city,
    status: customer.status,
    source: customer.source,
    companyId: customer.companyId,
    companyName: customer.company?.name || null,
    jobTitle: typeof custom.jobTitle === "string" ? custom.jobTitle : null,
    createdAt: customer.createdAt.toISOString(),
    companies,
    tickets: customer.tickets.map((t) => ({
      id: t.id,
      number: t.number,
      subject: t.subject,
      stage: t.stage.name,
      createdAt: t.createdAt.toISOString(),
    })),
    orders: customer.orders.map((o) => ({
      id: o.id,
      number: o.number,
      total: Number(o.total),
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
        formValues: parseOrderFormValues(i.formValues),
      })),
    })),
    conversations: customer.conversations.map((c) => ({
      id: c.id,
      channel: c.channel,
      subject: c.subject,
      externalRef: c.externalRef,
      lastMessageAt: c.lastMessageAt.toISOString(),
      preview: c.messages[0]?.body || null,
    })),
    deals: customer.deals.map((d) => ({
      id: d.id,
      title: d.title,
      value: Number(d.value),
      stage: d.stage.name,
    })),
    activities: customer.activities.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt.toISOString(),
      userName: a.user?.name || null,
    })),
    attachments: customer.attachments.map((a) => ({
      id: a.id,
      label: a.label,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export type CustomerProfileData = Awaited<ReturnType<typeof getCustomerProfile>>;
