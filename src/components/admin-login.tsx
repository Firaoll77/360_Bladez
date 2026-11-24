"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "@/lib/actions";

export function AdminLogin() {
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(false);
    startTransition(async () => {
      const res = await adminLogin(key);
      if (res.ok) router.refresh();
      else setError(true);
    });
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-bg-secondary p-8 shadow-[var(--shadow-card)]">
      <label className="text-sm font-semibold" htmlFor="key">Admin key</label>
      <input
        id="key"
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="mt-2 w-full rounded-[6px] border border-ink/20 bg-bg px-4 py-2.5 text-sm"
        placeholder="••••••••"
      />
      {error && <p className="mt-3 text-sm font-semibold text-red-700">Invalid key.</p>}
      <button
        onClick={submit}
        disabled={pending || !key}
        className="mt-6 w-full rounded-[6px] bg-dark px-6 py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:opacity-40"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </div>
  );
}
