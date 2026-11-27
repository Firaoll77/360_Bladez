"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Barber, Service } from "@prisma/client";
import {
  fetchDayAppointments,
  fetchBarberSchedule,
  submitBooking,
  type BarberScheduleEntry,
} from "@/lib/actions";
import {
  OPEN_MIN,
  CLOSE_MIN,
  SLOT_STEP_MIN,
  addDays,
  formatTime,
  isBreakSlot,
} from "@/lib/time";
import { formatEthDate, gregorianToEth } from "@/lib/ethiopian";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { intervalsOverlap, type BusyInterval } from "@/lib/slots";

interface Props {
  services: Service[];
  barbers: Barber[];
  today: string;
  nowMin: number;
  maxDate: string;
}

type Step = 1 | 2 | 3;

export function BookingWizard({ services, barbers, today, nowMin, maxDate }: Props) {
  const [step, setStep] = useState<Step>(1);

  // Step 1 — barber
  const [barberId, setBarberId] = useState("");
  const [schedule, setSchedule] = useState<BarberScheduleEntry[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Step 2 — date & time
  const [date, setDate] = useState(today);
  const [startMin, setStartMin] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [period, setPeriod] = useState<"AM" | "PM">("AM");
  const [dayBusy, setDayBusy] = useState<BusyInterval[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Step 3 — details
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("telebirr");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const service = services[0];
  const barber = barbers.find((b) => b.id === barberId);

  // Fetch schedule for the selected barber on demand
  useEffect(() => {
    if (!barberId) return;
    let active = true;
    setLoadingSchedule(true);
    fetchBarberSchedule(barberId, today, maxDate)
      .then((entries) => { if (active) setSchedule(entries); })
      .catch(() => { if (active) setSchedule([]); })
      .finally(() => { if (active) setLoadingSchedule(false); });
    return () => { active = false; };
  }, [barberId, today, maxDate]);

  /** Get effective hours for a barber on a date.
   *  No entry = shop defaults (fully available). */
  function getBarberHours(bId: string, d: string): { openMin: number; closeMin: number; available: boolean } {
    const entry = schedule.find((e) => e.barberId === bId && e.date === d);
    if (!entry) return { openMin: OPEN_MIN, closeMin: CLOSE_MIN, available: true };
    return {
      available: entry.available,
      openMin: entry.startMin ?? OPEN_MIN,
      closeMin: entry.endMin ?? CLOSE_MIN,
    };
  }

  /** True if the barber has at least one available date in the booking window. */
  function barberHasAnySchedule(bId: string): boolean {
    // A barber with no schedule entries at all is fully available by default
    const barberEntries = schedule.filter((e) => e.barberId === bId);
    if (barberEntries.length === 0) return true;
    // Otherwise check if at least one future date is available
    for (let i = 0; i <= 60; i++) {
      const d = addDays(today, i);
      const entry = barberEntries.find((e) => e.date === d);
      if (!entry || entry.available) return true;
    }
    return false;
  }

  // 7 days in the active week window
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(today, weekOffset + i)),
    [today, weekOffset]
  );

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length < 7) return "";
    const fmt = (s: string) => {
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 12));
      return `${dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ${d}`;
    };
    return `${fmt(weekDays[0])} to ${fmt(weekDays[6])}`;
  }, [weekDays]);

  const isNextWeekDisabled = useMemo(
    () => addDays(today, weekOffset + 7) > maxDate,
    [today, weekOffset, maxDate]
  );

  function getDayMeta(dtStr: string) {
    const [y, m, d] = dtStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    return {
      abbr: dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
      day: d,
    };
  }

  function pickDate(dt: string) {
    setDate(dt);
    setStartMin(null);
    if (dt === today && nowMin >= 720) setPeriod("PM");
  }

  function nextWeek() {
    const next = weekOffset + 7;
    setWeekOffset(next);
    // land on first available day in the new week
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, next + i);
      const { available } = getBarberHours(barberId, d);
      if (available && d >= today) { pickDate(d); return; }
    }
    pickDate(addDays(today, next));
  }

  function prevWeek() {
    const next = Math.max(0, weekOffset - 7);
    setWeekOffset(next);
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, next + i);
      const { available } = getBarberHours(barberId, d);
      if (available && d >= today) { pickDate(d); return; }
    }
    pickDate(addDays(today, next));
  }

  // Ethiopian calendar label for selected date
  const ethLabel = useMemo(() => {
    if (!date) return null;
    const [y, m, d] = date.split("-").map(Number);
    return formatEthDate(gregorianToEth(y, m, d));
  }, [date]);

  // Slot summary
  const selectedSlotSummary = useMemo(() => {
    if (!date || startMin === null) return "";
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    const weekday = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const month = dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    const duration = service?.durationMin ?? 30;
    return `${weekday}, ${month} ${d}, ${formatTime(startMin)} to ${formatTime(startMin + duration)}`;
  }, [date, startMin, service?.durationMin]);

  // Countdown label
  const startsInText = useMemo(() => {
    if (!date || startMin === null) return null;
    if (date === today) {
      const diff = startMin - nowMin;
      if (diff <= 0) return "Slot has passed";
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return h > 0 ? `Starts in ${h} h ${m} min` : `Starts in ${m} min`;
    }
    const [y1, m1, d1] = today.split("-").map(Number);
    const [y2, m2, d2] = date.split("-").map(Number);
    const days = Math.round(
      (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000
    );
    if (days === 1) return `Starts tomorrow at ${formatTime(startMin)}`;
    return `Starts in ${days} days at ${formatTime(startMin)}`;
  }, [date, startMin, today, nowMin]);

  // Load busy intervals when barber or date changes
  useEffect(() => {
    if (!barberId) return;
    let active = true;
    setLoadingSlots(true);
    fetchDayAppointments(barberId, date)
      .then((busy) => { if (active) setDayBusy(busy); })
      .catch(() => { if (active) setDayBusy([]); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [barberId, date]);

  // Generate slots respecting barber-specific hours
  const allSlots = useMemo(() => {
    const isToday = date === today;
    const { openMin, closeMin } = getBarberHours(barberId, date);

    const list: { min: number; isPassed: boolean; isFull: boolean }[] = [];
    for (let m = openMin; m <= closeMin - SLOT_STEP_MIN; m += SLOT_STEP_MIN) {
      if (isBreakSlot(m, SLOT_STEP_MIN)) continue;
      const isPassed = isToday && m <= nowMin;
      const candidate = { startMin: m, endMin: m + SLOT_STEP_MIN };
      const isFull = dayBusy.some((b) => intervalsOverlap(candidate, b));
      list.push({ min: m, isPassed, isFull });
    }
    return list;
  }, [date, today, nowMin, dayBusy, barberId, schedule]);

  const morningSlots = useMemo(() => allSlots.filter((s) => s.min < 720), [allSlots]);
  const afternoonSlots = useMemo(() => allSlots.filter((s) => s.min >= 720), [allSlots]);
  const activeSlots = period === "AM" ? morningSlots : afternoonSlots;

  async function onFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setProofUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setError(null);
    if (!proofUrl) {
      setError("Please upload your payment receipt screenshot to confirm your booking.");
      return;
    }
    startTransition(async () => {
      const res = await submitBooking({
        serviceId: service?.id ?? "",
        barberId,
        date,
        startMin: startMin!,
        customerName: name,
        customerPhone: phone,
        paymentMethod,
        paymentProofUrl: proofUrl,
        notes: notes || undefined,
      });
      if (res.ok) setDone({ id: res.id });
      else setError(res.error);
    });
  }

  // ── Confirmation screen ──────────────────────────────────────────────────
  if (done) {
    const refCode = done.id.slice(-8).toUpperCase();
    return (
      <div className="rounded-2xl border border-ink/10 bg-bg-secondary p-8 sm:p-10 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/20">
          <CheckCircle2 className="h-7 w-7 text-accent" />
        </div>
        <h2 className="font-display mt-4 text-3xl sm:text-4xl text-ink">You&rsquo;re booked!</h2>
        <p className="mt-2 text-sm text-ink-soft">
          A confirmation has been logged for <span className="font-semibold text-ink">{phone}</span>.
        </p>

        <div className="mt-6 mx-auto inline-flex items-center gap-3 rounded-xl border border-ink/15 bg-bg px-5 py-3 shadow-sm">
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">Booking Reference</p>
            <p className="font-mono text-xl font-bold tracking-widest text-ink">{refCode}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(refCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink hover:border-ink/30 transition-colors"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-6 mx-auto max-w-md rounded-xl bg-bg p-4 text-left text-sm text-ink border border-ink/10 space-y-2.5">
          <div className="flex justify-between border-b border-ink/10 pb-2">
            <span className="text-ink-soft">Barber:</span>
            <span className="font-semibold">{barber?.name}</span>
          </div>
          <div className="flex justify-between border-b border-ink/10 pb-2">
            <span className="text-ink-soft">Time:</span>
            <span className="font-semibold tabular-nums">{date} at {formatTime(startMin ?? 0)}</span>
          </div>
          {ethLabel && (
            <div className="flex justify-between border-b border-ink/10 pb-2">
              <span className="text-ink-soft">Ethiopian Date:</span>
              <span className="font-semibold text-accent">{ethLabel}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-ink/10 pb-2">
            <span className="text-ink-soft">Deposit paid:</span>
            <span className="font-semibold text-emerald-600 tabular-nums">400 ETB ({paymentMethod === "telebirr" ? "Telebirr" : "CBE"})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Balance due at shop:</span>
            <span className="font-semibold text-accent tabular-nums">400 ETB</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-ink-soft">Show this reference code at the front desk when you arrive.</p>

        <div className="mt-8 flex justify-center gap-4">
          <Link href="/book" className="rounded-xl bg-dark px-6 py-3 text-sm font-semibold text-bg hover:opacity-85 transition-opacity">
            Book Another
          </Link>
          <Link href="/bookings" className="rounded-xl border border-ink/20 px-6 py-3 text-sm font-medium hover:border-ink transition-colors">
            My Bookings
          </Link>
        </div>
      </div>
    );
  }

  const canNext =
    (step === 1 && !!barberId) ||
    (step === 2 && startMin !== null) ||
    (step === 3 && !!name.trim() && !!phone.trim() && !!proofUrl);

  return (
    <div className="rounded-lg border border-ink/10 bg-bg-secondary p-6 shadow-[var(--shadow-card)] md:p-10">
      {/* Step indicator */}
      <ol className="mb-10 flex items-center justify-between border-b border-ink/10 pb-6 text-xs font-semibold uppercase tracking-widest sm:justify-start sm:gap-6">
        {["Barber", "Date & Time", "Details"].map((label, i) => (
          <li key={label} className="flex items-center gap-2.5">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                step > i + 1
                  ? "bg-accent text-dark"
                  : step === i + 1
                  ? "bg-dark text-bg"
                  : "border border-ink/20 bg-bg text-ink-soft"
              }`}
            >
              {step > i + 1 ? "✓" : i + 1}
            </span>
            <span className={step === i + 1 ? "font-bold text-ink" : "hidden text-ink-soft sm:inline"}>
              {label}
            </span>
            {i < 2 && (
              <span className={`mx-2 hidden h-0.5 w-10 sm:inline transition-colors ${step > i + 1 ? "bg-accent" : "bg-ink/15"}`} />
            )}
          </li>
        ))}
      </ol>

      {/* ── STEP 1: Barber Selection ─────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl text-ink">Choose your barber</h2>
            <p className="mt-1 text-sm text-ink-soft">Greyed out barbers have no availability scheduled yet.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {barbers.map((b) => {
              const isSelected = barberId === b.id;
              const photoSrc = b.photoUrl || `/barbers/${b.name.toLowerCase().replace(/[^a-z]+/g, "")}.jpg`;

              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBarberId(b.id)}
                  className={`group flex flex-col items-center rounded-2xl border p-5 text-center transition-all duration-150 active:scale-[0.98] ${
                    isSelected
                      ? "border-accent bg-bg ring-2 ring-accent shadow-[var(--shadow-card)]"
                      : "border-ink/10 bg-bg hover:border-accent hover:shadow-md"
                  }`}
                >
                  <div className={`relative h-24 w-24 overflow-hidden rounded-full border-2 bg-dark shadow-sm transition-transform group-hover:scale-105 ${isSelected ? "border-accent" : "border-accent/40"}`}>
                    <Image src={photoSrc} alt={b.name} fill sizes="96px" className="object-cover" />
                  </div>
                  <p className="font-display mt-4 text-xl sm:text-2xl text-ink">{b.name}</p>
                  <p className="mt-0.5 text-xs font-semibold text-accent">{b.specialty}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 2: Date & Time ──────────────────────────────────────────── */}
      {step === 2 && (
        <div className="rounded-3xl border border-ink/10 bg-bg p-4 sm:p-8 shadow-sm">
          {/* Selected barber recap */}
          <div className="mb-5 flex items-center gap-3 rounded-xl bg-bg-secondary px-4 py-2.5 text-sm">
            <div className="relative h-8 w-8 overflow-hidden rounded-full border border-accent/40 bg-dark flex-shrink-0">
              <Image
                src={barber?.photoUrl || `/barbers/${barber?.name.toLowerCase().replace(/[^a-z]+/g, "")}.jpg`}
                alt={barber?.name ?? ""}
                fill sizes="32px" className="object-cover"
              />
            </div>
            <span className="font-semibold text-ink">{barber?.name}</span>
            <span className="text-ink-soft">·</span>
            <span className="text-ink-soft">{barber?.specialty}</span>
          </div>

          {/* Week header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl text-ink">Pick a date</h2>
              <p className="mt-1 text-sm font-medium text-ink-soft">{weekRangeLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={prevWeek} disabled={weekOffset === 0} aria-label="Previous week"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink/15 bg-bg text-ink transition-all hover:border-ink/40 active:scale-[0.96] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={nextWeek} disabled={isNextWeekDisabled} aria-label="Next week"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink/15 bg-bg text-ink transition-all hover:border-ink/40 active:scale-[0.96] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 7-day strip — uniform height, colour-only selection indicator */}
          <div className="mt-6 grid grid-cols-7 gap-1">
            {weekDays.map((dtStr) => {
              const meta = getDayMeta(dtStr);
              const isSelected = date === dtStr;
              const { available } = getBarberHours(barberId, dtStr);
              const isPast = dtStr < today;
              const isUnavailable = !available && !isPast;

              return (
                <button
                  key={dtStr}
                  type="button"
                  disabled={!available || isPast}
                  onClick={() => pickDate(dtStr)}
                  className={`flex h-16 flex-col items-center justify-center rounded-xl px-0.5 transition-all active:scale-[0.96] ${
                    isSelected
                      ? "bg-accent text-dark"
                      : !available || isPast
                      ? "opacity-30 cursor-not-allowed text-ink"
                      : "text-ink hover:bg-bg-secondary/70"
                  }`}
                >
                  <span className={`text-[9px] font-semibold uppercase tracking-wider ${isSelected ? "text-dark/80" : "text-ink-soft"}`}>
                    {meta.abbr}
                  </span>
                  <span className={`font-display text-base font-bold tabular-nums leading-tight ${isSelected ? "text-dark" : "text-ink"}`}>
                    {meta.day}
                  </span>
                  {isUnavailable && (
                    <span className={`text-[9px] font-bold uppercase ${isSelected ? "text-dark/70" : "text-ink-soft"}`}>off</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Unavailability note */}
          <p className="mt-2 text-xs text-ink-soft min-h-[1.25rem]">
            {weekDays.some((d) => !getBarberHours(barberId, d).available && d >= today) && (
              <span>
                <span className="font-semibold text-ink">{barber?.name}</span> is not available on greyed-out days.
              </span>
            )}
          </p>

          {/* AM / PM toggle */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              {period === "AM" ? "Morning" : "Afternoon"}
            </span>
            <div className="inline-flex rounded-full border border-ink/10 bg-bg-secondary/60 p-1">
              {(["AM", "PM"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPeriod(p)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    period === p ? "bg-bg text-ink shadow-sm border border-ink/10 font-bold" : "text-ink-soft hover:text-ink"
                  }`}>
                  <span>{p === "AM" ? "☼ AM" : "☾ PM"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Slot grid — tighter height */}
          {loadingSlots ? (
            <div className="mt-5 flex items-center justify-center py-10 text-sm text-ink-soft">
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent inline-block" />
              Checking availability…
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {activeSlots.length === 0 ? (
                <p className="col-span-full py-6 text-center text-sm text-ink-soft">
                  No {period === "AM" ? "morning" : "afternoon"} slots on this day.
                </p>
              ) : (
                activeSlots.map(({ min, isPassed, isFull }) => {
                  const isSelected = startMin === min;
                  const disabled = isPassed || isFull;
                  return (
                    <button key={min} type="button" disabled={disabled} onClick={() => setStartMin(min)}
                      className={`flex h-11 items-center justify-center rounded-xl text-sm font-medium transition-all tabular-nums ${
                        isSelected
                          ? "border-2 border-accent bg-accent font-bold text-dark shadow-md"
                          : disabled
                          ? "cursor-not-allowed border-2 border-dashed border-ink/20 bg-bg-secondary/20 text-ink/35 line-through"
                          : "border-2 border-ink/15 bg-bg text-ink hover:border-accent hover:text-accent active:scale-[0.96]"
                      }`}>
                      {isSelected && <span className="mr-1 text-xs font-black">✓</span>}
                      {formatTime(min)}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Footer summary + single CTA */}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-ink/10 pt-5">
            <div className="space-y-0.5">
              {startMin !== null ? (
                <>
                  <p className="font-bold text-ink text-sm tabular-nums">{selectedSlotSummary}</p>
                  {ethLabel && <p className="text-xs font-bold text-accent">{ethLabel}</p>}
                  {startsInText && (
                    <p className="flex items-center gap-1.5 text-xs text-ink-soft tabular-nums">
                      <Clock className="h-3.5 w-3.5 opacity-70" />
                      {startsInText}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-ink-soft italic">Select a time slot above</p>
              )}
            </div>
            <button type="button" onClick={() => setStep(3)} disabled={startMin === null}
              className="inline-flex items-center justify-center rounded-xl bg-accent px-8 py-3 font-display text-sm uppercase tracking-wider font-bold text-dark shadow-md transition-all hover:opacity-90 active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Details ──────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Booking summary banner */}
          <div className="rounded-2xl border border-ink/10 bg-bg p-5 text-sm shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 pb-3.5">
              <div>
                <p className="font-display text-2xl text-ink tabular-nums">
                  {barber?.name} · {formatTime(startMin ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft tabular-nums">{date} · {ethLabel}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent block">Prepayment Deposit</span>
                <p className="font-display text-3xl font-bold text-accent tabular-nums">400 ETB</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-bg-secondary/70 p-3">
                <span className="text-ink-soft block text-[11px] font-medium">Due now:</span>
                <span className="font-bold text-ink font-display text-lg tabular-nums">400 ETB</span>
              </div>
              <div className="rounded-xl bg-bg-secondary/70 p-3">
                <span className="text-ink-soft block text-[11px] font-medium">Due in person:</span>
                <span className="font-bold text-ink font-display text-lg tabular-nums">400 ETB</span>
              </div>
            </div>
          </div>

          {/* Name & phone */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-ink" htmlFor="name">Full name *</label>
              <input id="name" name="name" autoComplete="name" value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Abebe Kebede"
                className="mt-2 w-full rounded-xl border border-ink/20 bg-bg px-4 py-2.5 text-sm text-ink shadow-sm focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink" htmlFor="phone">Phone *</label>
              <input id="phone" type="tel" name="tel" autoComplete="tel" inputMode="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)} placeholder="+251 9xx xxx xxx"
                className="mt-2 w-full rounded-xl border border-ink/20 bg-bg px-4 py-2.5 text-sm text-ink shadow-sm focus:border-accent focus:outline-none" />
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="text-sm font-semibold text-ink">Prepayment Method</label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {[
                { id: "telebirr", label: "Telebirr", desc: "Mobile deposit" },
                { id: "cbe", label: "CBE Birr", desc: "Commercial Bank of Ethiopia" },
              ].map((p) => {
                const isSelected = paymentMethod === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => setPaymentMethod(p.id)}
                    className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                      isSelected ? "border-accent bg-bg ring-2 ring-accent/30 shadow-sm" : "border-ink/15 bg-bg/50 hover:border-ink/30 text-ink-soft hover:text-ink"
                    }`}>
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-bold ${isSelected ? "text-ink" : "text-ink-soft"}`}>{p.label}</span>
                      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${isSelected ? "border-accent bg-accent" : "border-ink/25"}`}>
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-dark" />}
                      </span>
                    </div>
                    <span className="mt-1 text-[11px] text-ink-soft">{p.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Receipt upload */}
            <div className="mt-4 rounded-xl border border-ink/20 bg-bg p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-ink">
                  Payment Receipt <span className="text-red-600">* (Required)</span>
                </p>
                {proofUrl && <span className="text-xs font-bold text-emerald-600">✓ Attached</span>}
              </div>
              <p className="mt-1 text-xs text-ink-soft leading-relaxed">
                Send <strong className="text-ink">400 ETB</strong> to our{" "}
                <strong className="text-ink">{paymentMethod === "telebirr" ? "Telebirr" : "CBE"}</strong> account then upload your receipt:
              </p>
              <div className="mt-2.5 rounded-lg bg-bg-secondary p-3 text-xs border border-ink/10">
                {paymentMethod === "telebirr" ? (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">Telebirr</span>
                    <p className="font-mono font-bold text-sm text-ink mt-0.5">+251 911 360 360 · 360 Bladez</p>
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">CBE</span>
                    <p className="font-mono font-bold text-sm text-ink mt-0.5">1000 4829 3602 · 360 Bladez Barbershop</p>
                  </div>
                )}
              </div>
              <input type="file" required accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="mt-3 block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-dark file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-bg hover:file:opacity-85 file:cursor-pointer cursor-pointer" />
              {uploading && (
                <p className="mt-2 text-xs text-ink-soft flex items-center gap-1.5 animate-pulse">
                  <span className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  Uploading…
                </p>
              )}
              {proofUrl && !uploading && (
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600">
                  <span>✓ Uploaded</span>
                  <a href={proofUrl} target="_blank" rel="noreferrer" className="text-accent underline text-[11px]">View ↗</a>
                </div>
              )}
              {!proofUrl && !uploading && (
                <p className="mt-2 text-[11px] text-amber-600 font-medium">
                  ⚠️ Receipt required to lock in your appointment.
                </p>
              )}
            </div>
          </div>

          {/* Optional notes */}
          <div className="pt-1">
            {!showNotes && !notes ? (
              <button type="button" onClick={() => setShowNotes(true)}
                className="text-xs font-medium text-ink-soft hover:text-accent transition-colors">
                + Add note or reference preference (optional)
              </button>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-ink" htmlFor="notes">Notes (optional)</label>
                  <button type="button" onClick={() => { setShowNotes(false); setNotes(""); }}
                    className="text-[11px] text-ink-soft hover:text-ink">Hide</button>
                </div>
                <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Skin fade preference, reference photo, allergies…"
                  className="mt-2 w-full rounded-xl border border-ink/20 bg-bg px-4 py-2 text-sm text-ink shadow-sm focus:border-accent focus:outline-none" />
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-6 text-sm font-semibold text-red-700">{error}</p>}

      {/* Navigation */}
      {step === 1 && (
        <div className="mt-10 flex justify-end border-t border-ink/10 pt-6">
          {loadingSchedule ? (
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent inline-block" />
              Checking availability…
            </div>
          ) : barberId && !barberHasAnySchedule(barberId) ? (
            <p className="text-sm font-semibold text-amber-600">
              {barbers.find((b) => b.id === barberId)?.name} has no scheduled days yet — check back soon or choose another barber.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                // Jump date to first available day for this barber
                for (let i = 0; i <= 60; i++) {
                  const d = addDays(today, i);
                  const { available } = getBarberHours(barberId, d);
                  if (available) { pickDate(d); break; }
                }
                setStep(2);
              }}
              disabled={!barberId}
              className="rounded-xl bg-dark px-8 py-3 text-sm font-semibold text-bg hover:opacity-85 active:scale-[0.96] disabled:opacity-40 transition-all"
            >
              Continue →
            </button>
          )}
        </div>
      )}
      {step > 1 && (
        <div className="mt-10 flex items-center justify-between border-t border-ink/10 pt-6">
          <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
            className="rounded-xl px-5 py-3 text-sm font-medium text-ink-soft hover:text-ink transition-all active:scale-[0.96]">
            ← Back
          </button>
          {step === 3 && (
            <button type="button" onClick={submit}
              disabled={pending || !name.trim() || !phone.trim() || !proofUrl || uploading}
              className="rounded-xl bg-accent px-8 py-3 font-display text-base tracking-wider uppercase font-semibold text-dark shadow-sm hover:opacity-90 active:scale-[0.96] disabled:opacity-40 transition-all">
              {pending ? "Booking…" : uploading ? "Uploading…" : !proofUrl ? "Upload Receipt to Confirm" : "Confirm Booking (400 ETB)"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
