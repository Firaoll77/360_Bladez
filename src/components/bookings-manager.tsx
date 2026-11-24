"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { cancelBookingAction, lookupPendingBooking, type PendingBookingData } from "@/lib/actions";
import { formatTime, getTimeLeft, todayEat } from "@/lib/time";
import { formatEthDate, gregorianToEth } from "@/lib/ethiopian";

export function BookingsManager() {
  const [refCode, setRefCode] = useState("");
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState<PendingBookingData | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showFullReceipt, setShowFullReceipt] = useState(false);
  const [pending, startTransition] = useTransition();

  function search() {
    setError(null);
    setSuccessMsg(null);
    setSearched(true);
    startTransition(async () => {
      const res = await lookupPendingBooking(refCode, phone);
      if (res.ok) {
        setBooking(res.booking);
      } else {
        setBooking(null);
        setError(res.error);
      }
    });
  }

  function cancel() {
    if (!booking) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelBookingAction(booking.id, booking.customerPhone);
      if (res.ok) {
        setBooking(null);
        setCancelling(false);
        setSuccessMsg("Your pending booking has been cancelled successfully.");
      } else {
        setError(res.error);
      }
    });
  }

  const today = todayEat();

  return (
    <div>
      {/* Search Form Card */}
      <div className="rounded-2xl border border-ink/10 bg-bg-secondary p-5 sm:p-6 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          {/* Reference Code */}
          <div>
            <label htmlFor="refCode" className="block text-xs font-semibold text-ink mb-1.5">
              Reference Code
            </label>
            <input
              id="refCode"
              type="text"
              name="refCode"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              value={refCode}
              onChange={(e) => setRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
              onKeyDown={(e) => e.key === "Enter" && refCode.trim() && phone.trim() && search()}
              placeholder="e.g. 7K2M9X4P"
              className="w-full font-mono tracking-wider rounded-xl border border-ink/20 bg-bg px-4 py-2.5 text-base sm:text-sm text-ink placeholder:font-sans placeholder:tracking-normal focus:border-accent focus:outline-none"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phone" className="block text-xs font-semibold text-ink mb-1.5">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              name="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refCode.trim() && phone.trim() && search()}
              placeholder="+251 9xx xxx xxx"
              className="w-full rounded-xl border border-ink/20 bg-bg px-4 py-2.5 text-base sm:text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={search}
            disabled={pending || !refCode.trim() || !phone.trim()}
            className="w-full sm:w-auto h-[42px] rounded-xl bg-dark px-7 text-sm font-semibold text-bg transition-all duration-150 hover:opacity-85 active:scale-[0.96] disabled:opacity-40"
          >
            {pending ? "Finding…" : "Find Booking"}
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          {successMsg}
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-sm font-medium text-amber-900 dark:text-amber-200">
          <p>{error}</p>
        </div>
      )}

      {/* Booking Details Result */}
      {booking && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-ink/15 bg-bg-secondary shadow-[var(--shadow-card)]">
          {/* Top Banner */}
          <div className="border-b border-ink/10 bg-amber-500/10 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Pending Verification
              </span>
            </div>
            <div className="font-mono text-xs font-semibold text-ink-soft">
              Ref: <span className="font-bold text-ink tracking-wider">{booking.refCode}</span>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Countdown / Time Left Banner */}
            <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">Time Left</p>
                  <p className="text-sm sm:text-base font-bold text-ink tabular-nums">
                    {getTimeLeft(booking.date, booking.startMin)}
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium text-ink-soft">Addis Ababa Time</span>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Customer Name */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Customer</p>
                <p className="font-display text-xl text-ink mt-0.5">{booking.customerName}</p>
                <p className="text-xs text-ink-soft tabular-nums">{booking.customerPhone}</p>
              </div>

              {/* Due Date & Time Slot */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Date & Time</p>
                {(() => {
                  const [y, m, d] = booking.date.split("-").map(Number);
                  const eth = formatEthDate(gregorianToEth(y, m, d));
                  return (
                    <div className="mt-0.5">
                      <p className="text-sm font-semibold text-ink tabular-nums">
                        {booking.date} · {formatTime(booking.startMin)} – {formatTime(booking.endMin)}
                        {booking.date === today && " · Today"}
                      </p>
                      <p className="text-xs text-ink-soft tabular-nums">Ethiopian: {eth}</p>
                    </div>
                  );
                })()}
              </div>

              {/* Barber Assigned */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Barber</p>
                <p className="text-sm font-semibold text-ink mt-0.5">{booking.barber.name}</p>
                <p className="text-xs text-ink-soft">{booking.barber.specialty}</p>
              </div>

              {/* Prepayment Deposit */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Deposit</p>
                <p className="text-sm font-semibold text-accent mt-0.5 tabular-nums">
                  400 ETB · {booking.paymentMethod?.toUpperCase() ?? "TELEBIRR"}
                </p>
                <p className="text-xs text-ink-soft mt-0.5">400 ETB remaining in person</p>
              </div>
            </div>

            {/* Receipt Preview */}
            <div className="pt-4 border-t border-ink/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {booking.paymentProofUrl ? (
                  <div
                    onClick={() => setShowFullReceipt(true)}
                    className="group relative cursor-pointer overflow-hidden rounded-lg border border-ink/15 bg-black/5 hover:border-accent transition-all flex-shrink-0"
                  >
                    <Image
                      src={booking.paymentProofUrl}
                      alt="Transfer receipt"
                      width={64}
                      height={64}
                      className="h-14 w-14 object-cover object-top transition-transform group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-semibold text-ink">Payment Receipt</p>
                  {booking.paymentProofUrl ? (
                    <button
                      type="button"
                      onClick={() => setShowFullReceipt(true)}
                      className="text-xs font-semibold text-accent underline hover:no-underline"
                    >
                      View receipt screenshot
                    </button>
                  ) : (
                    <p className="text-xs text-ink-soft">None attached</p>
                  )}
                </div>
              </div>

              {/* Cancel Button */}
              <div>
                {cancelling ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-red-600">Cancel booking?</span>
                    <button
                      type="button"
                      onClick={cancel}
                      disabled={pending}
                      className="font-bold text-red-700 underline hover:no-underline"
                    >
                      {pending ? "Cancelling…" : "Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelling(false)}
                      className="text-ink-soft underline hover:no-underline"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCancelling(true)}
                    disabled={pending}
                    className="text-xs font-semibold text-red-600 underline-offset-2 hover:underline disabled:opacity-40"
                  >
                    Cancel booking
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Receipt Modal */}
      {showFullReceipt && booking?.paymentProofUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowFullReceipt(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-lg overflow-auto rounded-2xl bg-bg p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-ink/10">
              <p className="text-sm font-bold text-ink">Payment Receipt Screenshot</p>
              <button
                type="button"
                onClick={() => setShowFullReceipt(false)}
                className="rounded-lg p-1 text-ink-soft hover:bg-ink/10 hover:text-ink"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex justify-center">
              <Image
                src={booking.paymentProofUrl}
                alt="Payment proof full"
                width={600}
                height={800}
                className="max-h-[75vh] w-auto object-contain rounded-xl"
                unoptimized
              />
            </div>
          </div>
        </div>
      )}

      {!booking && !searched && (
        <p className="mt-8 text-sm text-ink-soft">
          Need a cut? <Link href="/book" className="font-semibold text-accent underline">Book your appointment</Link>.
        </p>
      )}
    </div>
  );
}
