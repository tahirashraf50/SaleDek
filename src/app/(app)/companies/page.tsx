import Link from "next/link";
import {
  Building2,
  Factory,
  Mail,
  MapPin,
  Phone,
  Search,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { createCompany } from "@/server/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { searchParams: Promise<{ q?: string }> };

const AVATAR = ["#ef1e1e", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ac16e0"];

async function createCompanyAction(formData: FormData) {
  "use server";
  await createCompany({
    name: String(formData.get("name")),
    ntn: String(formData.get("ntn") || "") || undefined,
    strn: String(formData.get("strn") || "") || undefined,
    industry: String(formData.get("industry") || "") || undefined,
    website: String(formData.get("website") || "") || undefined,
    phone: String(formData.get("phone") || "") || undefined,
    email: String(formData.get("email") || "") || undefined,
    address: String(formData.get("address") || "") || undefined,
    city: String(formData.get("city") || "") || undefined,
    postalCode: String(formData.get("postalCode") || "") || undefined,
    notes: String(formData.get("notes") || "") || undefined,
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function CompaniesPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const { q } = await searchParams;
  const query = q?.trim();

  const where = {
    organizationId: session.organizationId,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { industry: { contains: query, mode: "insensitive" as const } },
            { city: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query, mode: "insensitive" as const } },
            { ntn: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [companies, totalAll, withCustomers, industries] = await Promise.all([
    db.company.findMany({
      where,
      orderBy: { name: "asc" },
      take: 100,
      include: { _count: { select: { customers: true } } },
    }),
    db.company.count({ where: { organizationId: session.organizationId } }),
    db.company.count({
      where: {
        organizationId: session.organizationId,
        customers: { some: {} },
      },
    }),
    db.company.findMany({
      where: {
        organizationId: session.organizationId,
        industry: { not: null },
      },
      select: { industry: true },
      distinct: ["industry"],
    }),
  ]);

  const contactCount = companies.reduce((s, c) => s + c._count.customers, 0);
  const industryCount = industries.filter((i) => i.industry?.trim()).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Companies
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Accounts & organizations · {companies.length}
            {query ? " matching" : " shown"}
            {totalAll !== companies.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <form action="/companies" method="get" className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              placeholder="Search name, industry, city, NTN…"
              defaultValue={query || ""}
              className="h-10 w-64 border-slate-200 bg-white pl-9 shadow-sm sm:w-72"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10 bg-white">
            Search
          </Button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Total companies</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ef1e1e] text-white shadow-md shadow-red-500/20">
              <Building2 className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">With contacts</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{withCustomers}</p>
          <p className="mt-1 text-[11px] text-slate-400">Linked customers</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Linked people</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {contactCount}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
              <Users className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Industries</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {industryCount}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white shadow-md shadow-amber-500/20">
              <Factory className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
              <h2 className="text-base font-semibold text-slate-900">
                All companies
              </h2>
            </div>
            <p className="text-xs text-slate-400">Click a row to open</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Company</th>
                  <th className="px-3 py-3 font-semibold">Industry</th>
                  <th className="px-3 py-3 font-semibold">Contact</th>
                  <th className="px-3 py-3 font-semibold">Customers</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((co, i) => (
                  <tr
                    key={co.id}
                    className="border-b border-slate-50 transition hover:bg-slate-50/90"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/companies/${co.id}`}
                        className="flex items-center gap-3"
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
                          style={{
                            backgroundColor: AVATAR[i % AVATAR.length],
                          }}
                        >
                          {initials(co.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 hover:text-[#ef1e1e]">
                            {co.name}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {co.ntn ? `NTN ${co.ntn}` : "No NTN"}
                            {co.city ? ` · ${co.city}` : ""}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      {co.industry ? (
                        <span className="inline-flex rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-100">
                          {co.industry}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="space-y-0.5 text-slate-600">
                        {co.phone ? (
                          <p className="flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {co.phone}
                          </p>
                        ) : null}
                        {co.email ? (
                          <p className="flex max-w-[160px] items-center gap-1.5 truncate text-xs">
                            <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                            {co.email}
                          </p>
                        ) : null}
                        {co.city && !co.phone && !co.email ? (
                          <p className="flex items-center gap-1.5 text-xs">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {co.city}
                          </p>
                        ) : null}
                        {!co.phone && !co.email && !co.city ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(172,22,224,0.08)] px-2 py-0.5 text-[11px] font-semibold text-[#8b10b8] ring-1 ring-[rgba(172,22,224,0.15)]">
                        <Users className="h-3 w-3" />
                        {co._count.customers}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {formatDate(co.createdAt)}
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-slate-800">
                          No companies found
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Create one on the right, or clear your search.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
            <h2 className="text-base font-semibold text-slate-900">
              New company
            </h2>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Add an account with tax IDs, contact, and address.
          </p>
          <form action={createCompanyAction} className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-[11px]">
                Name *
              </Label>
              <Input
                id="name"
                name="name"
                required
                className="h-9"
                placeholder="Company legal name"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="ntn" className="text-[11px]">
                  NTN
                </Label>
                <Input id="ntn" name="ntn" className="h-9" placeholder="Tax #" />
              </div>
              <div>
                <Label htmlFor="strn" className="text-[11px]">
                  STRN
                </Label>
                <Input id="strn" name="strn" className="h-9" placeholder="Sales tax #" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="industry" className="text-[11px]">
                  Industry
                </Label>
                <Input
                  id="industry"
                  name="industry"
                  className="h-9"
                  placeholder="e.g. Insurance"
                />
              </div>
              <div>
                <Label htmlFor="website" className="text-[11px]">
                  Website
                </Label>
                <Input
                  id="website"
                  name="website"
                  className="h-9"
                  placeholder="https://"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="phone" className="text-[11px]">
                Phone
              </Label>
              <Input id="phone" name="phone" className="h-9" />
            </div>
            <div>
              <Label htmlFor="email" className="text-[11px]">
                Email
              </Label>
              <Input id="email" name="email" type="email" className="h-9" />
            </div>
            <div>
              <Label htmlFor="address" className="text-[11px]">
                Address
              </Label>
              <Input id="address" name="address" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="city" className="text-[11px]">
                  City
                </Label>
                <Input id="city" name="city" className="h-9" />
              </div>
              <div>
                <Label htmlFor="postalCode" className="text-[11px]">
                  Postal
                </Label>
                <Input id="postalCode" name="postalCode" className="h-9" />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-[#ef1e1e] text-white hover:bg-[#d41919]"
            >
              Create company
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
