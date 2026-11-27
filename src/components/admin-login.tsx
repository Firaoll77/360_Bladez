"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { adminLogin } from "@/lib/actions";

export function AdminLogin() {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!key || pending) return;
    setErrorMsg(null);
    startTransition(async () => {
      const res = await adminLogin(key);
      if (res.ok) {
        router.refresh();
      } else {
        setErrorMsg(res.error ?? "Incorrect access code.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-bg-secondary p-8 shadow-[var(--shadow-card)]">
      {/* Label */}
      <label className="block text-sm font-semibold text-ink" htmlFor="key">
        Access code
      </label>

      {/* Input + show/hide */}
      <div className="relative mt-2">
        <input
          id="key"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full rounded-xl border border-ink/20 bg-bg px-4 py-3 pr-11 text-base text-ink focus:border-accent focus:outline-none"
          placeholder="Enter your access code"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink transition-colors"
          aria-label={show ? "Hide access code" : "Show access code"}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="mt-3.5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm font-semibold text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={submit}
        disabled={pending || !key}
        className={`mt-5 w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
          key && !pending
            ? "bg-dark text-bg hover:opacity-85"
            : "bg-ink/20 text-ink-soft"
        }`}
      >
        {pending ? "Verifying…" : "Sign in"}
      </button>

      {/* Subtle note */}
      <p className="mt-4 text-center text-xs text-ink-soft">Authorized staff only.</p>
    </div>
  );
}
