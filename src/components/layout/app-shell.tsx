"use client";

import { useEffect, useState } from "react";
import {
  Sidebar,
  type ModuleNavItem,
} from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { GlobalSearch } from "@/components/layout/global-search";
import { ComplaintModal } from "@/components/modals/complaint-modal";
import { SaleModal } from "@/components/modals/sale-modal";
import { CustomerModal } from "@/components/modals/customer-modal";
import type { UserMenuProfile } from "@/components/layout/user-menu";
import { CurrencyProvider } from "@/components/currency-provider";
import { Role, TicketChannel } from "@prisma/client";

export type AppLookup = {
  customers: { id: string; name: string; phone: string | null }[];
  departments: { id: string; name: string }[];
  ticketTypes: { id: string; name: string }[];
  users: { id: string; name: string }[];
  products: {
    id: string;
    name: string;
    unitPrice: number;
    taxPercent: number;
    formFields?: {
      id: string;
      label: string;
      type: "text" | "number" | "select";
      options?: string;
      required?: boolean;
    }[];
    priceRule?: {
      type: "percent_of_field";
      fieldId: string;
      percent: number;
    } | null;
  }[];
};

export type ComplaintPreset = {
  customerId?: string;
  conversationId?: string;
  channel?: TicketChannel;
  phone?: string;
  name?: string;
};

export type SalePreset = {
  customerId?: string;
  conversationId?: string;
  name?: string;
  phone?: string;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string | Date;
};

export function AppShell({
  children,
  orgName,
  orgSlug,
  userName,
  userRole,
  unread,
  notifications = [],
  lookup,
  moduleNav = [],
  profile,
  currency = "PKR",
}: {
  children: React.ReactNode;
  orgName?: string | null;
  orgSlug?: string | null;
  userName?: string | null;
  userRole?: Role | null;
  unread: number;
  notifications?: NotificationItem[];
  lookup: AppLookup;
  moduleNav?: ModuleNavItem[];
  profile: UserMenuProfile;
  currency?: string;
}) {
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [complaintPreset, setComplaintPreset] = useState<ComplaintPreset>();
  const [salePreset, setSalePreset] = useState<SalePreset>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    const onComplaint = (e: Event) => {
      const detail = (e as CustomEvent<ComplaintPreset>).detail;
      setComplaintPreset(detail);
      setComplaintOpen(true);
    };
    const onSale = (e: Event) => {
      const detail = (e as CustomEvent<SalePreset>).detail;
      setSalePreset(detail);
      setSaleOpen(true);
    };
    const onCustomer = () => setCustomerOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pulse:complaint", onComplaint);
    window.addEventListener("pulse:sale", onSale);
    window.addEventListener("pulse:customer", onCustomer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pulse:complaint", onComplaint);
      window.removeEventListener("pulse:sale", onSale);
      window.removeEventListener("pulse:customer", onCustomer);
    };
  }, []);

  return (
    <CurrencyProvider currency={currency}>
      <div className="flex h-screen overflow-hidden bg-[#f6f3fb]">
        <Sidebar
          orgName={orgName}
          orgSlug={orgSlug}
          role={userRole}
          moduleNav={moduleNav}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            profile={profile}
            unread={unread}
            notifications={notifications}
            onNewComplaint={() => {
              setComplaintPreset(undefined);
              setComplaintOpen(true);
            }}
            onNewSale={() => {
              setSalePreset(undefined);
              setSaleOpen(true);
            }}
            onNewCustomer={() => setCustomerOpen(true)}
            onSearch={() => setSearchOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-5 md:p-7">{children}</main>
        </div>

        <ComplaintModal
          open={complaintOpen}
          onOpenChange={setComplaintOpen}
          lookup={lookup}
          preset={complaintPreset}
        />
        <SaleModal
          open={saleOpen}
          onOpenChange={setSaleOpen}
          lookup={lookup}
          preset={salePreset}
        />
        <CustomerModal open={customerOpen} onOpenChange={setCustomerOpen} />
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </CurrencyProvider>
  );
}

export function openComplaintModal(preset?: ComplaintPreset) {
  window.dispatchEvent(new CustomEvent("pulse:complaint", { detail: preset }));
}

export function openSaleModal(preset?: SalePreset) {
  window.dispatchEvent(new CustomEvent("pulse:sale", { detail: preset }));
}

export function openCustomerModal() {
  window.dispatchEvent(new CustomEvent("pulse:customer"));
}
