import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const orgs = await db.organization.findMany({ select: { id: true, name: true } });
  const hash = await bcrypt.hash("demo1234", 10);
  for (const org of orgs) {
    let dept = await db.department.findFirst({
      where: { organizationId: org.id, name: "Underwriting" },
    });
    if (!dept) {
      dept = await db.department.create({
        data: { organizationId: org.id, name: "Underwriting", active: true },
      });
      console.log("Created Underwriting for", org.name);
    }
    const existing = await db.user.findUnique({
      where: { email: "underwriting@demo.com" },
    });
    if (!existing) {
      await db.user.create({
        data: {
          organizationId: org.id,
          email: "underwriting@demo.com",
          name: "Nadia Underwriting",
          passwordHash: hash,
          role: Role.DEPARTMENT_USER,
          departmentId: dept.id,
        },
      });
      console.log("Created underwriting@demo.com");
    } else if (existing.departmentId !== dept.id) {
      await db.user.update({
        where: { id: existing.id },
        data: { departmentId: dept.id, role: Role.DEPARTMENT_USER },
      });
      console.log("Linked underwriting user to dept");
    } else {
      console.log("Underwriting ready for", org.name);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
