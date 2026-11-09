"use client";

import { useActionState } from "react";
import { resendActivationEmail } from "@/server/actions/auth";

type ResendState = { error?: string; ok?: boolean };
const initial: ResendState = {};

export function ResendActivationForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(
    resendActivationEmail,
    initial,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="email" value={email} />
      {state.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-xs text-emerald-700">Activation email sent again.</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full text-sm font-medium text-[var(--site-purple)] hover:underline disabled:opacity-60"
      >
        {pending ? "Sending…" : "Resend activation email"}
      </button>
    </form>
  );
}
