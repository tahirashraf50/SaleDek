import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Public visitors land on the marketing site (/site).
 * Logged-in users go to their workspace (inbox / admin / etc.).
 */
export default async function Home() {
  try {
    const session = await auth();
    if (!session?.user) redirect("/site");
    if (session.user.role === "SUPER_ADMIN") redirect("/admin");
    if (session.user.organizationStatus === "SUSPENDED") redirect("/suspended");
    redirect("/inbox");
  } catch (err) {
    console.error("[home] auth failed, showing marketing site:", err);
    redirect("/site");
  }
}
