"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Barber, Service } from "@prisma/client";
import { fetchDayBusyAppointments, submitBooking } from "@/lib/actions";
import { CLOSE_MIN, OPEN_MIN, SLOT_STEP_MIN, addDays, formatTime, isBreakSlot } from "@/lib/time";
import { formatEthDate, gregorianToEth } from "@/lib/ethiopian";
import { intervalsOverlap, type BusyInterval } from "@/lib/slots";

interface Props {
  services: Service[];
  barbers: Barber[];
  today: string;
  nowMin: number;
  maxDate: string;
}

const BARBER_PHOTOS: Record<string, string> = {
  "Kaleb T.": "/barbers/kaleb.jpg",
  "Yonatan B.": "/barbers/yonatan.jpg",
  "Dawit M.": "/barbers/dawit.jpg",
  "Samuel A.": "/barbers/samuel.jpg",
};

type Step = 1 | 2 | 3;

interface BarberBusy extends BusyInterval {
  barberId: string;
}

export function BookingWizard({ services, barbers, today, nowMin, maxDate }: Props) {
  const [step, setStep] = useState<Step>(1);

  // Scheduling states
  const [date, setDate] = useState(today);
  const [startMin, setStartMin] = useState<number | null>(null);
  const [barberId, setBarberId] = useState("");
  const serviceId = services[0]?.id ?? "";

  // Slot availability
  const [dayBusy, setDayBusy] = useState<BarberBusy[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // 7-day week picker and AM/PM segmented control
  const [weekOffset, setWeekOffset] = useState(0);
  const [period, setPeriod] = useState<"AM" | "PM">("AM");

  // Customer details
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

  const service = services.find((s) => s.id === serviceId) ?? services[0];
  const barber = barbers.find((b) => b.id === barberId);

  // 7 days in the active week window
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(today, weekOffset + i));
  }, [today, weekOffset]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length < 7) return "";
    const formatMD = (dtStr: string) => {
      const [y, m, d] = dtStr.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      return `${dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ${d}`;
    };
    return `${formatMD(weekDays[0])} to ${formatMD(weekDays[6])}`;
  }, [weekDays]);

  const isNextWeekDisabled = useMemo(() => {
    return addDays(today, weekOffset + 7) > maxDate;
  }, [today, weekOffset, maxDate]);

  function nextWeek() {
    const nextOffset = weekOffset + 7;
    setWeekOffset(nextOffset);
    pickDate(addDays(today, nextOffset));
  }

  function prevWeek() {
    const nextOffset = Math.max(0, weekOffset - 7);
    setWeekOffset(nextOffset);
    pickDate(addDays(today, nextOffset));
  }

  function getDayMeta(dtStr: string) {
    const [y, m, d] = dtStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return {
      abbr: dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
      day: d,
    };
  }

  // Auto-switch to PM if picking today and morning slots have passed
  function pickDate(dt: string) {
    setDate(dt);
    setStartMin(null);
    if (dt === today && nowMin >= 720) {
      setPeriod("PM");
    }
  }

  function pickSlot(min: number) {
    setStartMin(min);
  }

  function pickBarber(id: string) {
    setBarberId(id);
  }

  // Ethiopian calendar label for the selected date
  const ethLabel = useMemo(() => {
    if (!date) return null;
    const [y, m, d] = date.split("-").map(Number);
    return formatEthDate(gregorianToEth(y, m, d));
  }, [date]);

  // Selected slot summary: e.g. "Sun, Nov 22, 9:00 AM to 9:30 AM"
  const selectedSlotSummary = useMemo(() => {
    if (!date || startMin === null) return "";
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const weekday = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const month = dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    const duration = service?.durationMin ?? 30;
    return `${weekday}, ${month} ${d}, ${formatTime(startMin)} to ${formatTime(startMin + duration)}`;
  }, [date, startMin, service?.durationMin]);

  // Relative countdown text: e.g. "Starts in 12 h 16 min"
  const startsInText = useMemo(() => {
    if (!date || startMin === null) return null;
    if (date === today) {
      const diffMin = startMin - nowMin;
      if (diffMin <= 0) return "Slot has passed";
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      return h > 0 ? `Starts in ${h} h ${m} min` : `Starts in ${m} min`;
    }
    const [y1, m1, d1] = today.split("-").map(Number);
    const [y2, m2, d2] = date.split("-").map(Number);
    const t1 = Date.UTC(y1, m1 - 1, d1);
    const t2 = Date.UTC(y2, m2 - 1, d2);
    const days = Math.round((t2 - t1) / 86400000);
    if (days === 1) return `Starts tomorrow at ${formatTime(startMin)}`;
    return `Starts in ${days} days at ${formatTime(startMin)}`;
  }, [date, startMin, today, nowMin]);

  // Load busy intervals whenever date changes
  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingSlots(true);
      try {
        const busy = await fetchDayBusyAppointments(date);
        if (active) {
          setDayBusy(busy as BarberBusy[]);
        }
      } catch {
        if (active) setDayBusy([]);
      } finally {
        if (active) setLoadingSlots(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [date]);

  // Generate all standard slots for shop opening hours (excluding 12:30 PM – 2:30 PM break)
  const allSlots = useMemo(() => {
    const list: { min: number; isPassed: boolean; isFull: boolean }[] = [];
    const isToday = date === today;

    for (let m = OPEN_MIN; m <= CLOSE_MIN - SLOT_STEP_MIN; m += SLOT_STEP_MIN) {
      if (isBreakSlot(m, SLOT_STEP_MIN)) continue;

      const isPassed = isToday && m <= nowMin;
      const candidate = { startMin: m, endMin: m + SLOT_STEP_MIN };

      // Count how many barbers are occupied in this slot
      const busyBarbers = new Set(
        dayBusy.filter((b) => intervalsOverlap(candidate, b)).map((b) => b.barberId)
      );
      const isFull = barbers.length > 0 && busyBarbers.size >= barbers.length;

      list.push({ min: m, isPassed, isFull });
    }
    return list;
  }, [date, today, nowMin, dayBusy, barbers.length]);

  // Check if a specific barber is busy at the selected start time
  function isBarberBusyAtSelectedTime(bId: string): boolean {
    if (startMin === null) return false;
    const duration = service?.durationMin ?? 30;
    const candidate = { startMin, endMin: startMin + duration };
    return dayBusy.some((b) => b.barberId === bId && intervalsOverlap(candidate, b));
  }

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
        serviceId: service?.id ?? services[0]?.id ?? "",
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

  // Booking confirmation view (Peak-end rule: specific, rewarding, actionable)
  if (done) {
    const refCode = done.id.slice(-8).toUpperCase();
    return (
      <div className="rounded-2xl border border-ink/10 bg-bg-secondary p-8 sm:p-10 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-dark">
          <svg className="h-7 w-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display mt-4 text-3xl sm:text-4xl text-ink">You&rsquo;re booked!</h2>
        <p className="mt-2 text-sm text-ink-soft">
          A confirmation has been logged for <span className="font-semibold text-ink">{phone}</span>.
        </p>

        {/* Reference Code Card (Recognition over recall & Tesler's law: 1-tap copy) */}
        <div className="mt-6 mx-auto inline-flex items-center gap-3 rounded-xl border border-ink/15 bg-bg px-5 py-3 shadow-sm">
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">Booking Reference</p>
            <p className="font-mono text-xl font-bold tracking-widest text-ink">{refCode}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(refCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink hover:border-ink/30 transition-colors"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

        {/* Appointment Summary Card */}
        <div className="mt-6 mx-auto max-w-md rounded-xl bg-bg p-4 text-left text-sm text-ink border border-ink/10 space-y-2.5">
          <div className="flex justify-between border-b border-ink/10 pb-2">
            <span className="text-ink-soft">Barber:</span>
            <span className="font-semibold text-ink">{barber?.name}</span>
          </div>
          <div className="flex justify-between border-b border-ink/10 pb-2">
            <span className="text-ink-soft">Time:</span>
            <span className="font-semibold text-ink">{date} at {formatTime(startMin ?? 0)}</span>
          </div>
          {ethLabel && (
            <div className="flex justify-between border-b border-ink/10 pb-2">
              <span className="text-ink-soft">Ethiopian Date:</span>
              <span className="font-semibold text-accent">{ethLabel}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-ink/10 pb-2">
            <span className="text-ink-soft">Prepayment Deposit:</span>
            <span className="font-semibold text-emerald-600">400 ETB ({paymentMethod === "telebirr" ? "Telebirr" : "CBE"})</span>
          </div>
          <div className="flex justify-between border-b border-ink/10 pb-2">
            <span className="text-ink-soft">Balance due at shop:</span>
            <span className="font-semibold text-accent">400 ETB (Total 800 ETB)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Service Style:</span>
            <span className="font-medium text-ink">Choose with your barber upon arrival</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-ink-soft">
          Please show this reference code at the front desk when you arrive.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/book"
            className="rounded-xl bg-dark px-6 py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-85"
          >
            Book Another
          </Link>
          <Link
            href="/bookings"
            className="rounded-xl border border-ink/20 px-6 py-3 text-sm font-medium transition-colors hover:border-ink"
          >
            My Bookings
          </Link>
        </div>
      </div>
    );
  }

  const canNext =
    (step === 1 && !!date && startMin !== null) ||
    (step === 2 && !!barberId && !isBarberBusyAtSelectedTime(barberId)) ||
    (step === 3 && !!name.trim() && !!phone.trim() && !!proofUrl);

  return (
    <div className="rounded-lg border border-ink/10 bg-bg-secondary p-6 shadow-[var(--shadow-card)] md:p-10">
      {/* Step indicator: Uniform Connectedness & Goal-Gradient progress */}
      <ol className="mb-10 flex items-center justify-between border-b border-ink/10 pb-6 text-xs font-semibold uppercase tracking-widest sm:justify-start sm:gap-6">
        {["Time & Date", "Barber", "Details"].map((label, i) => (
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
              <span
                className={`mx-2 hidden h-0.5 w-10 sm:inline transition-colors ${
                  step > i + 1 ? "bg-accent" : "bg-ink/15"
                }`}
              />
            )}
          </li>
        ))}
      </ol>

      {/* STEP 1: Date & Time Selection (Matched to image design with 360_Bladez system palette) */}
      {step === 1 && (
        <div className="rounded-3xl border border-ink/10 bg-bg p-5 sm:p-8 shadow-sm">
          {/* Card Top: Title, Week Range & Week Pagination */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                Pick a time
              </h2>
              <p className="mt-1 text-sm font-medium text-ink-soft">
                {weekRangeLabel}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prevWeek}
                disabled={weekOffset === 0}
                aria-label="Previous week"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink/15 bg-bg text-ink transition-all hover:border-ink/40 active:scale-[0.96] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={nextWeek}
                disabled={isNextWeekDisabled}
                aria-label="Next week"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink/15 bg-bg text-ink transition-all hover:border-ink/40 active:scale-[0.96] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* 7-Day Date Selector Strip */}
          <div className="mt-6 grid grid-cols-7 gap-1 sm:gap-2">
            {weekDays.map((dtStr) => {
              const meta = getDayMeta(dtStr);
              const isSelected = date === dtStr;
              return (
                <button
                  key={dtStr}
                  type="button"
                  onClick={() => pickDate(dtStr)}
                  className={`group flex flex-col items-center justify-center py-3 sm:py-4 px-1 rounded-2xl transition-all active:scale-[0.96] ${
                    isSelected
                      ? "bg-accent text-dark font-bold shadow-lg ring-2 ring-accent/30 -translate-y-0.5"
                      : "text-ink hover:bg-bg-secondary/60"
                  }`}
                >
                  <span
                    className={`text-[10px] sm:text-xs font-semibold tracking-wider ${
                      isSelected ? "text-dark/90 font-bold" : "text-ink-soft"
                    }`}
                  >
                    {meta.abbr}
                  </span>
                  <span
                    className={`mt-1 font-display text-lg sm:text-2xl font-bold tabular-nums ${
                      isSelected ? "text-dark" : "text-ink"
                    }`}
                  >
                    {meta.day}
                  </span>
                  <span
                    className={`mt-1.5 flex items-center justify-center gap-0.5 text-[8px] leading-none ${
                      isSelected ? "text-dark/80" : "text-ink/25"
                    }`}
                  >
                    <span>•</span><span>•</span><span>•</span><span>•</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Time Slot Header & AM/PM Segmented Control */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-6">
            <div className="flex items-center gap-2.5">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink-soft">
                {period === "AM" ? "Morning Slots" : "Afternoon Slots"}
              </span>
              {period === "PM" && (
                <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                  Break: 12:30 – 2:30 PM
                </span>
              )}
            </div>

            <div className="inline-flex rounded-full border border-ink/10 bg-bg-secondary/60 p-1">
              <button
                type="button"
                onClick={() => setPeriod("AM")}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  period === "AM"
                    ? "bg-bg text-ink shadow-sm border border-ink/10 font-bold"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                <span className="text-sm">☼</span>
                <span>AM</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriod("PM")}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  period === "PM"
                    ? "bg-bg text-ink shadow-sm border border-ink/10 font-bold"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                <span className="text-sm">☾</span>
                <span>PM (to 6:30 PM)</span>
              </button>
            </div>
          </div>

          {/* Time Slots Grid (Zero-layout-shift borders & tabular numbers) */}
          {loadingSlots ? (
            <div className="mt-6 flex items-center justify-center py-12 text-sm text-ink-soft">
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Checking chair availability…
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {activeSlots.map(({ min, isPassed, isFull }) => {
                const isSelected = startMin === min;
                const disabled = isPassed || isFull;

                return (
                  <button
                    key={min}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickSlot(min)}
                    className={`flex items-center justify-center rounded-2xl py-3.5 px-3 text-sm font-medium transition-all duration-150 tabular-nums ${
                      isSelected
                        ? "border-2 border-accent bg-accent font-bold text-dark shadow-md"
                        : disabled
                          ? "cursor-not-allowed border-2 border-dashed border-ink/20 bg-bg-secondary/20 text-ink/35 line-through decoration-ink/20"
                          : "border-2 border-ink/15 bg-bg text-ink hover:border-accent hover:text-accent hover:shadow-sm active:scale-[0.96]"
                    }`}
                  >
                    {disabled && (
                      <span className="mr-2 text-xs opacity-60 no-underline">⊘</span>
                    )}
                    {isSelected && (
                      <span className="mr-1.5 text-xs font-black">✓</span>
                    )}
                    <span>{formatTime(min)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Timezone Notice */}
          <div className="mt-8 flex items-center gap-2 text-xs text-ink-soft">
            <svg className="h-4 w-4 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
              <path strokeWidth="1.5" d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>Times shown in Africa/Addis_Ababa (UTC+3) · East Africa Time</span>
          </div>

          {/* Card Footer: Selection Summary, Ethiopian Calendar & Capsule Proceed Button */}
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-ink/10 pt-6">
            <div className="space-y-1">
              {startMin !== null ? (
                <>
                  <p className="font-bold text-ink text-sm sm:text-base tabular-nums">
                    {selectedSlotSummary}
                  </p>
                  {ethLabel && (
                    <p className="text-xs sm:text-sm font-bold text-accent tabular-nums">
                      {ethLabel}
                    </p>
                  )}
                  {startsInText && (
                    <p className="flex items-center gap-1.5 text-xs text-ink-soft tabular-nums">
                      <svg className="h-3.5 w-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
                        <path strokeWidth="1.5" d="M12 7v5l3 2" />
                      </svg>
                      <span>{startsInText}</span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-ink-soft italic">
                  Select an available time slot above to proceed
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={startMin === null}
              className="inline-flex items-center justify-center rounded-2xl bg-accent px-8 py-3.5 font-display text-sm uppercase tracking-wider font-bold text-dark shadow-md transition-all duration-150 hover:opacity-90 active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed sm:w-auto"
            >
              Proceed →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Barber Selection — Name & Photo Only */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="rounded-md bg-bg p-3.5 text-sm text-ink shadow-sm">
            <span className="font-semibold text-accent">Selected Slot: </span>
            <span>{date} ({ethLabel}) at {formatTime(startMin ?? 0)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {barbers.map((b) => {
              const isSelected = barberId === b.id;
              const isBusy = isBarberBusyAtSelectedTime(b.id);
              const photoSrc =
                b.photoUrl ||
                BARBER_PHOTOS[b.name] ||
                `/barbers/${b.name.toLowerCase().replace(/[^a-z]+/g, "")}.jpg`;

              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => pickBarber(b.id)}
                  className={`group flex flex-col items-center rounded-2xl border p-5 text-center transition-all duration-150 active:scale-[0.98] ${
                    isSelected
                      ? "border-accent bg-bg ring-2 ring-accent shadow-[var(--shadow-card)]"
                      : isBusy
                        ? "cursor-not-allowed border-ink/10 bg-bg/50 opacity-40"
                        : "border-ink/10 bg-bg hover:border-accent hover:shadow-md"
                  }`}
                >
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-accent/40 bg-dark shadow-sm transition-transform group-hover:scale-105">
                    <Image
                      src={photoSrc}
                      alt={b.name}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>

                  <p className="font-display mt-4 text-xl sm:text-2xl text-ink">
                    {b.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3: Customer Details & Prepayment Deposit */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Prepayment & Pricing Breakdown Banner */}
          <div className="rounded-2xl border border-ink/10 bg-bg p-5 text-sm shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 pb-3.5">
              <div>
                <p className="font-display text-2xl text-ink tabular-nums">
                  {barber?.name} · {formatTime(startMin ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft tabular-nums">
                  {date} · {ethLabel}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent block">Prepayment Deposit</span>
                <p className="font-display text-3xl font-bold text-accent tabular-nums">
                  400 ETB
                </p>
              </div>
            </div>

            {/* Split Breakdown */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-bg-secondary/70 p-3">
                <span className="text-ink-soft block text-[11px] font-medium">Due now (Prepayment deposit):</span>
                <span className="font-bold text-ink font-display text-lg tabular-nums">400 ETB</span>
              </div>
              <div className="rounded-xl bg-bg-secondary/70 p-3">
                <span className="text-ink-soft block text-[11px] font-medium">Due in person at the shop:</span>
                <span className="font-bold text-ink font-display text-lg tabular-nums">400 ETB</span>
              </div>
            </div>
          </div>

          {/* Customer name and phone (Parkinson's law: browser autofill hints) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-ink" htmlFor="name">
                Full name *
              </label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Abebe Kebede"
                className="mt-2 w-full rounded-xl border border-ink/20 bg-bg px-4 py-2.5 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink" htmlFor="phone">
                Phone *
              </label>
              <input
                id="phone"
                type="tel"
                name="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 9xx xxx xxx"
                className="mt-2 w-full rounded-xl border border-ink/20 bg-bg px-4 py-2.5 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Payment method (Telebirr or CBE Birr) */}
          <div>
            <label className="text-sm font-semibold text-ink">
              Prepayment Method
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {[
                { id: "telebirr", label: "Telebirr", desc: "Mobile deposit" },
                { id: "cbe", label: "CBE Birr", desc: "Commercial Bank of Ethiopia" },
              ].map((p) => {
                const isSelected = paymentMethod === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPaymentMethod(p.id)}
                    className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-accent bg-bg ring-2 ring-accent/30 shadow-sm"
                        : "border-ink/15 bg-bg/50 hover:border-ink/30 text-ink-soft hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-bold ${isSelected ? "text-ink" : "text-ink-soft"}`}>
                        {p.label}
                      </span>
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                          isSelected ? "border-accent bg-accent" : "border-ink/25"
                        }`}
                      >
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-dark" />}
                      </span>
                    </div>
                    <span className="mt-1 text-[11px] text-ink-soft">
                      {p.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Mandatory Payment Proof Upload */}
            <div className="mt-4 rounded-xl border border-ink/20 bg-bg p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-ink">
                  Payment Receipt Screenshot <span className="text-red-600">* (Required)</span>
                </p>
                {proofUrl && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    ✓ Receipt Attached
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-ink-soft leading-relaxed">
                Send the <strong className="text-ink">400 ETB deposit</strong> to our{" "}
                <strong className="text-ink">{paymentMethod === "telebirr" ? "Telebirr" : "CBE"}</strong> account, then upload your transaction receipt screenshot below:
              </p>

              {/* Account numbers box */}
              <div className="mt-2.5 rounded-lg bg-bg-secondary p-3 text-xs border border-ink/10">
                {paymentMethod === "telebirr" ? (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">Telebirr Account Number</span>
                    <p className="font-mono font-bold text-sm text-ink mt-0.5">+251 911 360 360 · 360 Bladez</p>
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft block">CBE Account Number</span>
                    <p className="font-mono font-bold text-sm text-ink mt-0.5">1000 4829 3602 · 360 Bladez Barbershop</p>
                  </div>
                )}
              </div>

              <input
                type="file"
                required
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="mt-3 block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-dark file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-bg hover:file:opacity-85 file:cursor-pointer cursor-pointer"
              />
              {uploading && (
                <p className="mt-2 text-xs text-ink-soft flex items-center gap-1.5 animate-pulse">
                  <span className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  Uploading receipt screenshot…
                </p>
              )}
              {proofUrl && !uploading && (
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600">
                  <span>✓ Receipt screenshot uploaded successfully</span>
                  <a href={proofUrl} target="_blank" rel="noreferrer" className="text-accent underline text-[11px]">
                    View preview ↗
                  </a>
                </div>
              )}
              {!proofUrl && !uploading && (
                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Receipt screenshot is required to lock in your appointment.
                </p>
              )}
            </div>
          </div>

          {/* Optional notes (Progressive disclosure & Occam's razor: hidden until requested) */}
          <div className="pt-1">
            {!showNotes && !notes ? (
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className="text-xs font-medium text-ink-soft hover:text-accent transition-colors"
              >
                + Add note or reference preference (optional)
              </button>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-ink" htmlFor="notes">
                    Notes (optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotes(false);
                      setNotes("");
                    }}
                    className="text-[11px] text-ink-soft hover:text-ink"
                  >
                    Hide
                  </button>
                </div>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Skin fade preference, reference photo, allergies…"
                  className="mt-2 w-full rounded-xl border border-ink/20 bg-bg px-4 py-2 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-6 text-sm font-semibold text-red-700">{error}</p>}

      {/* Navigation buttons for steps 2 and 3 (Step 1 has Proceed inside its card footer) */}
      {step > 1 && (
        <div className="mt-10 flex items-center justify-between border-t border-ink/10 pt-6">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
            className="rounded-xl px-5 py-3 text-sm font-medium text-ink-soft transition-all duration-150 hover:text-ink active:scale-[0.96]"
          >
            ← Back
          </button>
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!canNext}
              className="rounded-xl bg-dark px-8 py-3 text-sm font-semibold text-bg transition-all duration-150 hover:opacity-85 active:scale-[0.96] disabled:opacity-40"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={pending || !name.trim() || !phone.trim() || !proofUrl || uploading}
              className="rounded-xl bg-accent px-8 py-3 font-display text-base tracking-wider uppercase font-semibold text-dark shadow-sm transition-all duration-150 hover:opacity-90 active:scale-[0.96] disabled:opacity-40"
            >
              {pending
                ? "Booking…"
                : uploading
                  ? "Uploading Receipt…"
                  : !proofUrl
                    ? "Upload Receipt to Confirm"
                    : "Confirm Booking (400 ETB Deposit)"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
