import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/site");
  if (session.user.role === "SUPER_ADMIN") redirect("/admin");
  if (session.user.organizationStatus === "SUSPENDED") redirect("/suspended");
  redirect("/inbox");
}
