import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Workspace suspended</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            This tenant is suspended by the platform administrator. Contact support or your
            SaleDek account manager.
          </p>
          <Link href="/" className="text-teal-700 hover:underline">
            Back to SaleDek website
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
