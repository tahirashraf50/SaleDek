import Link from "next/link";
import {
  BarChart3,
  Headphones,
  Mail,
  Target,
  Users,
  Workflow,
} from "lucide-react";

const FEATURES = [
  {
    title: "Contact Management",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: Users,
  },
  {
    title: "Sales Automation",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: Workflow,
  },
  {
    title: "Email Integration",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: Mail,
  },
  {
    title: "Task and Activity",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: Target,
  },
  {
    title: "Reporting and Analytics",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: BarChart3,
  },
  {
    title: "Customer Support",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: Headphones,
  },
];

export default function FeaturesPage() {
  return (
    <div className="site-hero-glow pt-28 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="site-pill">Core Features</span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--site-ink)] md:text-6xl">
            Core Features
          </h1>
          <p className="mt-4 text-[var(--site-muted)]">
            The only business management tool that combines CRM, time tracking, project
            management, invoicing and payments.
          </p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="site-feature-card">
                <span className="site-icon-blob">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-5 text-xl font-semibold text-[var(--site-ink)]">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--site-muted)]">{f.body}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-14 text-center">
          <Link href="/register?plan=DEMO" className="site-btn-primary">
            Try for Free
          </Link>
        </div>
      </div>
    </div>
  );
}
