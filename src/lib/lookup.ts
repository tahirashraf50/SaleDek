import { db } from "@/lib/db";
import { parseProductFormConfig } from "@/lib/product-form";

export async function getAppLookup(organizationId: string) {
  const [customers, departments, ticketTypes, users, products] =
    await Promise.all([
      db.customer.findMany({
        where: { organizationId },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
      db.department.findMany({
        where: { organizationId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.ticketType.findMany({
        where: { organizationId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.user.findMany({
        where: { organizationId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.product.findMany({
        where: { organizationId, active: true },
        select: {
          id: true,
          name: true,
          unitPrice: true,
          taxPercent: true,
          formFields: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

  return {
    customers,
    departments,
    ticketTypes,
    users,
    products: products.map((p) => {
      const config = parseProductFormConfig(p.formFields);
      return {
        id: p.id,
        name: p.name,
        unitPrice: Number(p.unitPrice),
        taxPercent: Number(p.taxPercent),
        formFields: config.fields,
        priceRule: config.priceRule,
      };
    }),
  };
}
