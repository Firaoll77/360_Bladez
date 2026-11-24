"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "@/lib/actions";

export function AdminLogin() {
  const [key, setKey] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await adminLogin(key);
      if (res.ok) {
        router.refresh();
      } else {
        setErrorMsg(res.error ?? "Invalid passkey.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-bg-secondary p-8 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 mb-4">
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">Restricted Portal</span>
      </div>

      <label className="text-xs font-semibold text-ink" htmlFor="key">Passkey</label>
      <input
        id="key"
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && key && submit()}
        className="mt-1.5 w-full rounded-xl border border-ink/20 bg-bg px-4 py-3 text-base sm:text-sm text-ink focus:border-accent focus:outline-none"
        placeholder="••••••••••••"
      />

      {errorMsg && (
        <div className="mt-3.5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-600">
          {errorMsg}
        </div>
      )}

      <button
        onClick={submit}
        disabled={pending || !key}
        className="mt-6 w-full rounded-xl bg-dark px-6 py-3 text-sm font-semibold text-bg transition-all hover:opacity-85 active:scale-[0.98] disabled:opacity-40"
      >
        {pending ? "Verifying…" : "Unlock Portal"}
      </button>

      <p className="mt-4 text-[11px] text-center text-ink-soft">
        Protected by rate limiting & brute-force mitigation
      </p>
    </div>
  );
}
