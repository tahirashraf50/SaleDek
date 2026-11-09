"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/actions/auth";

const initialState: LoginState = {};

export function LoginForm({
  brandName,
  defaultEmail,
  activated,
}: {
  brandName: string;
  defaultEmail?: string;
  activated?: boolean;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="site-anim-fade w-full max-w-[400px] lg:-mt-8">
      <span className="site-pill">Agent login</span>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--site-ink)] md:text-4xl">
        Welcome back
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--site-muted)]">
        Sign in to your {brandName} workspace
      </p>

      <form action={formAction} className="mt-7 space-y-4">
        {activated ? (
          <p
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            Email verified — your account is enabled. Sign in to continue.
          </p>
        ) : null}
        {state.error ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {state.error}
          </p>
        ) : null}
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--site-muted)]"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={defaultEmail || ""}
            autoComplete="email"
            className="h-12 w-full rounded-2xl border border-[var(--site-line)] bg-white px-4 text-sm text-[var(--site-ink)] outline-none transition focus:border-[var(--site-purple)] focus:ring-4 focus:ring-[rgba(172,22,224,0.12)]"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--site-muted)]"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-12 w-full rounded-2xl border border-[var(--site-line)] bg-white px-4 text-sm text-[var(--site-ink)] outline-none transition focus:border-[var(--site-purple)] focus:ring-4 focus:ring-[rgba(172,22,224,0.12)]"
          />
        </div>
        <button type="submit" disabled={pending} className="site-btn-primary w-full disabled:opacity-60">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-sm text-[var(--site-muted)]">
        New org?{" "}
        <Link href="/register" className="font-semibold text-[var(--site-purple)] hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
