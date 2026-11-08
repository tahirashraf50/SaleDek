import { Role, TenantStatus } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      organizationId: string | null;
      organizationName?: string | null;
      organizationStatus?: TenantStatus | null;
      organizationSlug?: string | null;
      departmentId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    organizationId: string | null;
    organizationName?: string | null;
    organizationStatus?: TenantStatus | null;
    organizationSlug?: string | null;
    departmentId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    organizationId: string | null;
    organizationName?: string | null;
    organizationStatus?: TenantStatus | null;
    organizationSlug?: string | null;
    departmentId?: string | null;
  }
}
