import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Default demo org portal */
export default function PortalIndex() {
  redirect("/portal/demo-telecom");
}
