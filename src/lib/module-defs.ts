export const MODULE_KEYS = [
  "UNDERWRITING",
  "FINANCE",
  "OPERATIONS",
  "SALES",
  "TECHNICAL",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  href: string;
  description: string;
};

export const MODULE_DEFS: ModuleDef[] = [
  {
    key: "UNDERWRITING",
    label: "Underwriting",
    href: "/underwriting",
    description: "Allocate policy #, attach document, email customer",
  },
  {
    key: "FINANCE",
    label: "Finance",
    href: "/finance",
    description: "Confirm payments and clear installments",
  },
  {
    key: "OPERATIONS",
    label: "Operations",
    href: "/operations",
    description: "Activate / handoff after policy or payment",
  },
  {
    key: "SALES",
    label: "Sales",
    href: "/sales/desk",
    description: "Deals and order follow-ups for sales desk",
  },
  {
    key: "TECHNICAL",
    label: "Technical",
    href: "/technical",
    description: "Technical department ticket queue",
  },
];

export function moduleDef(key: ModuleKey) {
  return MODULE_DEFS.find((m) => m.key === key)!;
}
