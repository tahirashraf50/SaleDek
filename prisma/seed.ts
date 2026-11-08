import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedOrganizationDefaults } from "../src/lib/org-defaults";
import { addDays, subDays } from "date-fns";

const db = new PrismaClient();

async function main() {
  // Production-safe: never wipe a live DB on every `npm start`.
  // Force a full reseed with SEED_FORCE=1 (local only).
  const force = process.env.SEED_FORCE === "1";
  const existingUsers = await db.user.count().catch(() => 0);
  if (!force && existingUsers > 0) {
    console.log(`Seed skipped (${existingUsers} users already present).`);
    return;
  }

  if (force) {
    await db.auditLog.deleteMany();
    await db.notification.deleteMany();
    await db.automationRule.deleteMany();
    await db.installment.deleteMany();
    await db.payment.deleteMany();
    await db.orderItem.deleteMany();
    await db.order.deleteMany();
    await db.deal.deleteMany();
    await db.csatResponse.deleteMany();
    await db.slaTimer.deleteMany();
    await db.ticketLink.deleteMany();
    await db.ticketWatcher.deleteMany();
    await db.ticketNote.deleteMany();
    await db.ticketTag.deleteMany();
    await db.attachment.deleteMany();
    await db.ticket.deleteMany();
    await db.message.deleteMany();
    await db.callLog.deleteMany();
    await db.conversation.deleteMany();
    await db.productReview.deleteMany();
    await db.channelConnector.deleteMany();
    await db.activity.deleteMany();
    await db.note.deleteMany();
    await db.customerTag.deleteMany();
    await db.customer.deleteMany();
    await db.company.deleteMany();
    await db.tag.deleteMany();
    await db.product.deleteMany();
    await db.slaPolicy.deleteMany();
    await db.ticketType.deleteMany();
    await db.ticketStage.deleteMany();
    await db.dealStage.deleteMany();
    await db.knowledgeArticle.deleteMany();
    await db.customField.deleteMany();
    await db.savedView.deleteMany();
    await db.teamMember.deleteMany();
    await db.team.deleteMany();
    await db.user.deleteMany();
    await db.orgSubscription.deleteMany();
    await db.department.deleteMany();
    await db.organization.deleteMany();
    await db.saaSPlan.deleteMany();
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);

  await db.user.create({
    data: {
      email: "super@pulsecrm.com",
      name: "Platform Super Admin",
      passwordHash,
      role: Role.SUPER_ADMIN,
      organizationId: null,
    },
  });

  await db.saaSPlan.create({
    data: {
      key: "DEMO",
      name: "Demo",
      priceMonthly: 0,
      description: "15-day free sandbox to try PulseCRM end-to-end",
      features: [
        "Full CRM modules",
        "Up to 3 users",
        "200 tickets during trial",
        "Portal + shop preview",
        "No credit card",
      ],
      maxUsers: 3,
      maxTicketsPerMonth: 200,
      trialDays: 15,
      sortOrder: 0,
    },
  });
  await db.saaSPlan.create({
    data: {
      key: "STARTER",
      name: "Starter",
      priceMonthly: 9999,
      description: "For small support desks getting started",
      features: ["1 inbox", "Up to 5 users", "500 tickets/mo", "Basic reports"],
      maxUsers: 5,
      maxTicketsPerMonth: 500,
      sortOrder: 1,
    },
  });
  const pro = await db.saaSPlan.create({
    data: {
      key: "PRO",
      name: "Pro",
      priceMonthly: 24999,
      description: "Omnichannel + sales for growing teams",
      features: [
        "WhatsApp / Email / Call inbox",
        "Up to 25 users",
        "5,000 tickets/mo",
        "Sales + installments",
        "Automation rules",
      ],
      maxUsers: 25,
      maxTicketsPerMonth: 5000,
      sortOrder: 2,
    },
  });
  await db.saaSPlan.create({
    data: {
      key: "ENTERPRISE",
      name: "Enterprise",
      priceMonthly: 59999,
      description: "Scale, controls, and priority support",
      features: [
        "Unlimited users*",
        "Unlimited tickets*",
        "SLA + advanced reporting",
        "Channel connectors",
        "Dedicated onboarding",
      ],
      maxUsers: 500,
      maxTicketsPerMonth: 100000,
      sortOrder: 3,
    },
  });

  const org = await db.organization.create({
    data: {
      name: "Demo Telecom CRM",
      slug: "demo-telecom",
      status: "ACTIVE",
      planId: pro.id,
      trialEndsAt: addDays(new Date(), 30),
    },
  });

  await db.orgSubscription.create({
    data: {
      organizationId: org.id,
      planId: pro.id,
      status: "ACTIVE",
      renewsAt: addDays(new Date(), 30),
    },
  });

  await seedOrganizationDefaults(db, org.id);

  const support = await db.department.findFirst({
    where: { organizationId: org.id, name: "Customer Support" },
  });
  const finance = await db.department.findFirst({
    where: { organizationId: org.id, name: "Finance" },
  });
  const underwriting = await db.department.findFirst({
    where: { organizationId: org.id, name: "Underwriting" },
  });

  const admin = await db.user.create({
    data: {
      organizationId: org.id,
      email: "admin@demo.com",
      name: "Ayesha Admin",
      passwordHash,
      role: Role.ORG_ADMIN,
    },
  });

  const manager = await db.user.create({
    data: {
      organizationId: org.id,
      email: "manager@demo.com",
      name: "Bilal Manager",
      passwordHash,
      role: Role.MANAGER,
      departmentId: support?.id,
    },
  });

  const agent = await db.user.create({
    data: {
      organizationId: org.id,
      email: "agent@demo.com",
      name: "Sara Agent",
      passwordHash,
      role: Role.AGENT,
      departmentId: support?.id,
    },
  });

  await db.user.create({
    data: {
      organizationId: org.id,
      email: "finance@demo.com",
      name: "Omar Finance",
      passwordHash,
      role: Role.DEPARTMENT_USER,
      departmentId: finance?.id,
    },
  });

  await db.user.create({
    data: {
      organizationId: org.id,
      email: "underwriting@demo.com",
      name: "Nadia Underwriting",
      passwordHash,
      role: Role.DEPARTMENT_USER,
      departmentId: underwriting?.id,
    },
  });

  const company = await db.company.create({
    data: {
      organizationId: org.id,
      name: "Pak Retail Pvt Ltd",
      industry: "Retail",
      city: "Lahore",
      phone: "042-111222333",
    },
  });

  const customers = await Promise.all(
    [
      { name: "Ali Raza", phone: "03001234567", email: "ali@example.com", city: "Lahore", status: "ACTIVE" as const },
      { name: "Fatima Khan", phone: "03017654321", email: "fatima@example.com", city: "Karachi", status: "ACTIVE" as const },
      { name: "Hassan Ahmed", phone: "03331239876", email: "hassan@example.com", city: "Islamabad", status: "LEAD" as const, companyId: company.id },
    ].map((c) =>
      db.customer.create({
        data: {
          organizationId: org.id,
          ownerId: agent.id,
          ...c,
        },
      })
    )
  );

  await db.tag.createMany({
    data: [
      { organizationId: org.id, name: "VIP", color: "#f59e0b" },
      { organizationId: org.id, name: "Repeat", color: "#0d9488" },
    ],
  });

  const products = await Promise.all(
    [
      { name: "Fiber 50Mbps", sku: "FB-50", unitPrice: 3500, category: "Internet", description: "Reliable home fiber — ideal for browsing and HD streaming." },
      { name: "Fiber 100Mbps", sku: "FB-100", unitPrice: 5500, category: "Internet", description: "Faster fiber for work-from-home and 4K." },
      { name: "IPTV Bundle", sku: "TV-01", unitPrice: 1500, category: "Entertainment", description: "Local + international channels add-on." },
      { name: "Router AX3000", sku: "HW-R1", unitPrice: 12000, category: "Hardware", description: "Wi-Fi 6 router with installment options." },
    ].map((p) =>
      db.product.create({
        data: { organizationId: org.id, taxPercent: 0, ...p },
      })
    )
  );

  await db.productReview.createMany({
    data: [
      {
        organizationId: org.id,
        productId: products[0].id,
        authorName: "Sana",
        rating: 5,
        comment: "Speed stable — good value package.",
      },
      {
        organizationId: org.id,
        productId: products[1].id,
        authorName: "Imran",
        rating: 4,
        comment: "Great for Zoom calls. Install was quick.",
      },
    ],
  });

  const stages = await db.ticketStage.findMany({ where: { organizationId: org.id } });
  const newStage = stages.find((s) => s.key === "NEW")!;
  const progressStage = stages.find((s) => s.key === "IN_PROGRESS")!;
  const billingType = await db.ticketType.findFirst({
    where: { organizationId: org.id, name: "Billing" },
  });

  const t1 = await db.ticket.create({
    data: {
      organizationId: org.id,
      number: 1001,
      subject: "Incorrect bill charged",
      description: "Customer was charged double for March invoice.",
      priority: "HIGH",
      channel: "PHONE",
      stageId: progressStage.id,
      typeId: billingType?.id,
      customerId: customers[0].id,
      departmentId: finance?.id,
      assigneeId: agent.id,
      createdById: agent.id,
    },
  });

  await db.ticket.create({
    data: {
      organizationId: org.id,
      number: 1002,
      subject: "Slow internet after midnight",
      description: "Speed drops below 10Mbps after 12am.",
      priority: "MEDIUM",
      channel: "WHATSAPP",
      stageId: newStage.id,
      customerId: customers[1].id,
      departmentId: support?.id,
      createdById: agent.id,
    },
  });

  await db.organization.update({
    where: { id: org.id },
    data: { ticketCounter: 1002 },
  });

  const dealStage = await db.dealStage.findFirst({
    where: { organizationId: org.id, key: "PROPOSAL" },
  });

  const deal = await db.deal.create({
    data: {
      organizationId: org.id,
      number: 1001,
      title: "Fiber upgrade — Hassan",
      customerId: customers[2].id,
      stageId: dealStage!.id,
      ownerId: agent.id,
      value: 17500,
      closeDate: addDays(new Date(), 7),
    },
  });

  const order = await db.order.create({
    data: {
      organizationId: org.id,
      number: 1001,
      customerId: customers[0].id,
      dealId: deal.id,
      createdById: agent.id,
      paymentMethod: "BANK",
      status: "PENDING",
      paymentStatus: "PENDING",
      subtotal: 5500,
      discount: 0,
      tax: 0,
      total: 5500,
      items: {
        create: [
          {
            productId: products[1].id,
            name: products[1].name,
            unitPrice: 5500,
            quantity: 1,
            lineTotal: 5500,
          },
        ],
      },
      payments: {
        create: {
          method: "BANK",
          status: "PENDING",
          amount: 5500,
        },
      },
    },
  });

  const installmentOrder = await db.order.create({
    data: {
      organizationId: org.id,
      number: 1002,
      customerId: customers[1].id,
      createdById: agent.id,
      paymentMethod: "INSTALLMENT",
      status: "PARTIAL",
      paymentStatus: "PARTIAL",
      subtotal: 12000,
      total: 12000,
      discount: 0,
      tax: 0,
      items: {
        create: [
          {
            productId: products[3].id,
            name: products[3].name,
            unitPrice: 12000,
            quantity: 1,
            lineTotal: 12000,
          },
        ],
      },
      installments: {
        create: [
          { number: 1, amount: 4000, dueDate: subDays(new Date(), 5), status: "PAID", paidAt: subDays(new Date(), 4) },
          { number: 2, amount: 4000, dueDate: addDays(new Date(), 25), status: "PENDING" },
          { number: 3, amount: 4000, dueDate: addDays(new Date(), 55), status: "PENDING" },
        ],
      },
    },
  });

  await db.organization.update({
    where: { id: org.id },
    data: { orderCounter: 1002, dealCounter: 1001 },
  });

  await db.automationRule.create({
    data: {
      organizationId: org.id,
      name: "Billing → Finance",
      trigger: "TICKET_CREATED",
      conditions: [{ field: "typeName", op: "eq", value: "Billing" }],
      actions: finance
        ? [{ type: "assign_department", departmentId: finance.id }]
        : [],
      active: true,
    },
  });

  await db.automationRule.create({
    data: {
      organizationId: org.id,
      name: "Urgent notify manager",
      trigger: "TICKET_CREATED",
      conditions: [{ field: "priority", op: "eq", value: "URGENT" }],
      actions: [
        { type: "notify_user", userId: manager.id, title: "Urgent ticket created" },
        { type: "set_priority", priority: "URGENT" },
      ],
      active: true,
    },
  });

  await db.knowledgeArticle.create({
    data: {
      organizationId: org.id,
      title: "How to reverse duplicate billing",
      category: "Billing",
      body: "1. Verify invoice IDs\n2. Raise adjustment in Finance\n3. Confirm with customer",
    },
  });

  await db.activity.createMany({
    data: [
      {
        organizationId: org.id,
        customerId: customers[0].id,
        ticketId: t1.id,
        userId: agent.id,
        type: "TICKET",
        title: "Ticket #1001 created",
      },
      {
        organizationId: org.id,
        customerId: customers[0].id,
        orderId: order.id,
        userId: agent.id,
        type: "SALE",
        title: "Order #1001 created",
      },
      {
        organizationId: org.id,
        customerId: customers[1].id,
        orderId: installmentOrder.id,
        userId: agent.id,
        type: "SALE",
        title: "Installment order #1002 created",
      },
    ],
  });

  await db.notification.create({
    data: {
      organizationId: org.id,
      userId: agent.id,
      title: "Welcome to Demo Telecom CRM",
      body: "Open Inbox for WhatsApp / Email / Call workspace.",
      href: "/inbox",
    },
  });

  await db.conversation.create({
    data: {
      organizationId: org.id,
      channel: "WHATSAPP",
      customerId: customers[0].id,
      externalRef: customers[0].phone,
      assigneeId: agent.id,
      status: "OPEN",
      unreadCount: 1,
      lastMessageAt: new Date(),
      messages: {
        create: [
          {
            direction: "IN",
            body: "Assalam o Alaikum, mere bill mein double charge aa gaya hai.",
            sentAt: subDays(new Date(), 0),
          },
          {
            direction: "OUT",
            body: "Walaikum Assalam! Ticket create kar rahe hain, please CNIC confirm karein.",
            authorUserId: agent.id,
            sentAt: subDays(new Date(), 0),
          },
          {
            direction: "IN",
            body: "CNIC 35202-1234567-1. Jaldi fix kar dein.",
            sentAt: new Date(),
          },
        ],
      },
    },
  });

  await db.conversation.create({
    data: {
      organizationId: org.id,
      channel: "WHATSAPP",
      customerId: customers[1].id,
      externalRef: customers[1].phone,
      status: "PENDING",
      unreadCount: 0,
      lastMessageAt: subDays(new Date(), 1),
      messages: {
        create: [
          {
            direction: "IN",
            body: "Internet bohot slow hai raat ko.",
            sentAt: subDays(new Date(), 1),
          },
        ],
      },
    },
  });

  await db.conversation.create({
    data: {
      organizationId: org.id,
      channel: "EMAIL",
      customerId: customers[2].id,
      externalRef: customers[2].email,
      subject: "Upgrade to Fiber 100Mbps",
      status: "OPEN",
      unreadCount: 1,
      lastMessageAt: new Date(),
      messages: {
        create: [
          {
            direction: "IN",
            subject: "Upgrade to Fiber 100Mbps",
            body: "Hi team,\n\nPlease share package details for Fiber 100Mbps and router installment options.\n\nThanks,\nHassan",
            sentAt: subDays(new Date(), 0),
          },
        ],
      },
    },
  });

  await db.conversation.create({
    data: {
      organizationId: org.id,
      channel: "PORTAL",
      customerId: customers[1].id,
      externalRef: "portal-msg-1",
      subject: "Portal feedback",
      status: "OPEN",
      unreadCount: 0,
      lastMessageAt: subDays(new Date(), 2),
      messages: {
        create: [
          {
            direction: "IN",
            body: "Submitted via customer portal: connection drop every evening.",
          },
        ],
      },
    },
  });

  const callConv = await db.conversation.create({
    data: {
      organizationId: org.id,
      channel: "CALL",
      customerId: customers[0].id,
      externalRef: "03001234567",
      subject: "Billing enquiry call",
      assigneeId: agent.id,
      status: "CLOSED",
      messages: {
        create: [
          {
            direction: "IN",
            body: "Customer called about March double billing.",
          },
        ],
      },
    },
  });

  await db.callLog.create({
    data: {
      organizationId: org.id,
      conversationId: callConv.id,
      customerId: customers[0].id,
      agentId: agent.id,
      phone: "03001234567",
      callerName: "Ali Raza",
      reason: "Billing enquiry",
      notes: "Asked to open complaint — ticket #1001 linked.",
      outcome: "COMPLAINT_CREATED",
      startedAt: subDays(new Date(), 0),
    },
  });

  await db.callLog.create({
    data: {
      organizationId: org.id,
      phone: "03019876543",
      callerName: "Unknown caller",
      reason: "New connection interest",
      notes: "Missed — follow up needed",
      outcome: "LOGGED",
      agentId: agent.id,
      startedAt: subDays(new Date(), 1),
    },
  });

  await db.channelConnector.createMany({
    data: [
      { organizationId: org.id, channel: "WHATSAPP", name: "WhatsApp (UI)", enabled: true, mode: "UI_ONLY" },
      { organizationId: org.id, channel: "EMAIL", name: "Email (UI)", enabled: true, mode: "UI_ONLY" },
      { organizationId: org.id, channel: "CALL", name: "Call Intake", enabled: true, mode: "UI_ONLY" },
      { organizationId: org.id, channel: "PORTAL", name: "Portal", enabled: true, mode: "UI_ONLY" },
    ],
  });

  await db.knowledgeArticle.create({
    data: {
      organizationId: org.id,
      title: "Speed drop after midnight — checklist",
      category: "Technical",
      body: "1. Check peak-hour contention\n2. Ask customer for speedtest screenshot\n3. Escalate to Technical if <50% of plan",
    },
  });

  console.log("Seed complete.");
  console.log("Super admin: super@pulsecrm.com / demo1234 → /admin");
  console.log("Tenant admin: admin@demo.com / demo1234 → /inbox");
  console.log("Underwriting: underwriting@demo.com / demo1234 → /underwriting");
  console.log("Marketing: /  |  Shop: /shop/demo-telecom  |  Portal: /portal/demo-telecom");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
