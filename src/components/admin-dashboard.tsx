"use client";

import { useState, useTransition, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Appointment, Service, Barber } from "@prisma/client";
import {
  adminLogout,
  setAppointmentStatus,
  createBarber,
  updateBarber,
  deleteBarber,
  toggleBarberActive,
} from "@/lib/actions";
import { formatTime, todayEat } from "@/lib/time";
import { formatEthDate, gregorianToEth } from "@/lib/ethiopian";

export type BarberWithStats = Barber & {
  _count?: { appointments: number };
};

type Appt = Appointment & { service: Service; barber: Barber };

const STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;

export function AdminDashboard({
  appointments,
  barbers,
}: {
  appointments: Appt[];
  barbers: BarberWithStats[];
}) {
  const [activeMenu, setActiveMenu] = useState<"appointments" | "barbers">("appointments");
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>("upcoming");
  const [search, setSearch] = useState<string>("");
  const [barberFilter, setBarberFilter] = useState<string>("all");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // System confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: "danger" | "warning" | "primary";
    onConfirm: () => void;
  } | null>(null);

  // Auto-dismiss feedback after 5 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Lightbox for payment proof
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);

  // Barber modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<BarberWithStats | null>(null);

  // Desktop sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => !prev);
  }

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar on desktop
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const router = useRouter();
  const today = todayEat();

  // Metrics
  const pendingCount = useMemo(
    () => appointments.filter((a) => a.status === "pending").length,
    [appointments]
  );
  const todayCount = useMemo(
    () => appointments.filter((a) => a.date === today && a.status !== "cancelled").length,
    [appointments, today]
  );
  const upcomingCount = useMemo(
    () =>
      appointments.filter(
        (a) => a.date >= today && a.status !== "cancelled" && a.status !== "completed"
      ).length,
    [appointments, today]
  );
  const activeBarbersCount = useMemo(
    () => barbers.filter((b) => b.active).length,
    [barbers]
  );

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      // Status filter
      if (filter === "upcoming") {
        if (!(a.date >= today && a.status !== "cancelled" && a.status !== "completed")) {
          return false;
        }
      } else if (filter !== "all" && a.status !== filter) {
        return false;
      }

      // Barber filter
      if (barberFilter !== "all" && a.barberId !== barberFilter) {
        return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = a.customerName.toLowerCase().includes(q);
        const matchesPhone = a.customerPhone.toLowerCase().includes(q);
        const matchesService = a.service.name.toLowerCase().includes(q);
        const matchesBarber = a.barber.name.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesService && !matchesBarber) {
          return false;
        }
      }

      return true;
    });
  }, [appointments, filter, barberFilter, search, today]);

  function setStatus(id: string, status: string) {
    startTransition(async () => {
      const res = await setAppointmentStatus(id, status);
      if (res.ok) {
        setFeedback({
          type: "success",
          text: `Booking status updated to "${status}".`,
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          text: res.error ?? "Failed to update booking status.",
        });
      }
    });
  }

  function handleRejectAppointment(id: string, customerName: string) {
    setConfirmDialog({
      title: "Reject Appointment?",
      message: `Are you sure you want to reject the booking for "${customerName}"? This will mark the appointment as cancelled.`,
      confirmLabel: "Reject Booking",
      confirmVariant: "danger",
      onConfirm: () => {
        setConfirmDialog(null);
        setStatus(id, "cancelled");
      },
    });
  }

  function logout() {
    startTransition(async () => {
      await adminLogout();
      router.refresh();
    });
  }

  function handleOpenAdd() {
    setEditingBarber(null);
    setIsModalOpen(true);
    setFeedback(null);
  }

  function handleOpenEdit(b: BarberWithStats) {
    setEditingBarber(b);
    setIsModalOpen(true);
    setFeedback(null);
  }

  function handleToggleActive(b: BarberWithStats) {
    startTransition(async () => {
      try {
        await toggleBarberActive(b.id, !b.active);
        setFeedback({
          type: "success",
          text: `${b.name} is now ${!b.active ? "active and visible for bookings" : "deactivated"}.`,
        });
        router.refresh();
      } catch {
        setFeedback({ type: "error", text: "Failed to update barber status." });
      }
    });
  }

  function handleDelete(b: BarberWithStats) {
    const hasAppts = (b._count?.appointments ?? 0) > 0;

    setConfirmDialog({
      title: hasAppts ? "Deactivate Barber?" : "Delete Barber?",
      message: hasAppts
        ? `"${b.name}" has ${b._count?.appointments} appointment(s). Deactivating them will hide them from future customer bookings while preserving their booking history.`
        : `Are you sure you want to delete "${b.name}"? This action cannot be undone.`,
      confirmLabel: hasAppts ? "Deactivate" : "Delete",
      confirmVariant: "danger",
      onConfirm: () => {
        setConfirmDialog(null);
        startTransition(async () => {
          try {
            const res = await deleteBarber(b.id);
            if (res.ok) {
              setFeedback({ type: "success", text: res.message });
              router.refresh();
            } else {
              setFeedback({ type: "error", text: res.error ?? "Failed to delete barber." });
            }
          } catch {
            setFeedback({ type: "error", text: "Error deleting barber." });
          }
        });
      },
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row w-full">
      {/* ================= MOBILE NAV BAR (< md) ================= */}
      <div className="md:hidden sticky top-16 z-30 flex items-center justify-between border-b border-ink/10 bg-bg-secondary/95 backdrop-blur-md px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveMenu("appointments");
              setFeedback(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeMenu === "appointments"
                ? "bg-dark text-bg shadow-sm"
                : "text-ink-soft hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <span>Appointments</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeMenu === "appointments"
                  ? "bg-accent text-dark"
                  : pendingCount > 0
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold"
                    : "bg-ink/10 text-ink"
              }`}
            >
              {pendingCount > 0 ? `${pendingCount} new` : appointments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenu("barbers");
              setFeedback(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeMenu === "barbers"
                ? "bg-dark text-bg shadow-sm"
                : "text-ink-soft hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <span>Barbers</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeMenu === "barbers"
                  ? "bg-accent text-dark"
                  : "bg-ink/10 text-ink"
              }`}
            >
              {barbers.length}
            </span>
          </button>
        </div>

        <button
          onClick={logout}
          className="rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* ================= DESKTOP SIDEBAR (md and up) ================= */}
      <aside
        className={`hidden md:flex flex-col justify-between border-r border-ink/10 bg-bg-secondary transition-all duration-300 sticky top-16 h-[calc(100vh-4rem)] shrink-0 z-20 overflow-y-auto ${
          sidebarCollapsed ? "w-20 p-3" : "w-64 p-5"
        }`}
      >
        <div>
          {/* Brand header */}
          <div
            className={`flex items-center pb-5 border-b border-ink/10 ${
              sidebarCollapsed ? "justify-center flex-col gap-2" : "justify-between gap-3"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-accent/60">
                <Image
                  src="/logo3.jpg"
                  alt="360_Bladez logo"
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
              {!sidebarCollapsed && (
                <div className="overflow-hidden transition-all">
                  <h2 className="font-display text-xl tracking-wider text-ink leading-tight">
                    360_Bladez
                  </h2>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                    Admin Portal
                  </p>
                </div>
              )}
            </div>

            {/* Desktop toggle button inside sidebar header */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-ink/10 hover:text-ink transition-colors"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.8" />
                <path d="M9 3v18" strokeWidth="1.8" />
                {sidebarCollapsed ? (
                  <path d="M14 9l3 3-3 3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M16 15l-3-3 3-3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveMenu("appointments");
                setFeedback(null);
              }}
              title={
                sidebarCollapsed
                  ? `Appointments (${pendingCount > 0 ? `${pendingCount} new` : appointments.length})`
                  : undefined
              }
              className={`relative flex items-center rounded-xl transition-all ${
                sidebarCollapsed
                  ? "justify-center p-3"
                  : "justify-between px-4 py-3"
              } text-sm font-medium ${
                activeMenu === "appointments"
                  ? "bg-dark text-bg shadow-sm"
                  : "text-ink-soft hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg
                    className="h-5 w-5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {sidebarCollapsed && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-dark">
                      {pendingCount}
                    </span>
                  )}
                </div>
                {!sidebarCollapsed && <span>Appointments</span>}
              </div>

              {!sidebarCollapsed && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    activeMenu === "appointments"
                      ? "bg-accent text-dark font-display"
                      : pendingCount > 0
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold"
                        : "bg-ink/10 text-ink"
                  }`}
                >
                  {pendingCount > 0 ? `${pendingCount} new` : appointments.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMenu("barbers");
                setFeedback(null);
              }}
              title={sidebarCollapsed ? `Manage Barbers (${barbers.length})` : undefined}
              className={`relative flex items-center rounded-xl transition-all ${
                sidebarCollapsed
                  ? "justify-center p-3"
                  : "justify-between px-4 py-3"
              } text-sm font-medium ${
                activeMenu === "barbers"
                  ? "bg-dark text-bg shadow-sm"
                  : "text-ink-soft hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg
                    className="h-5 w-5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  {sidebarCollapsed && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-dark">
                      {barbers.length}
                    </span>
                  )}
                </div>
                {!sidebarCollapsed && <span>Manage Barbers</span>}
              </div>

              {!sidebarCollapsed && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    activeMenu === "barbers"
                      ? "bg-accent text-dark font-display"
                      : "bg-ink/10 text-ink"
                  }`}
                >
                  {barbers.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-ink/10 pt-5 space-y-4">
          {!sidebarCollapsed ? (
            <div className="rounded-lg bg-bg/60 p-3 text-xs text-ink-soft">
              <div className="flex items-center gap-1.5 font-medium text-ink">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span>Addis Ababa Time</span>
              </div>
              <p className="mt-1 text-[11px] text-ink-soft">East Africa Time (UTC+3)</p>
            </div>
          ) : (
            <div
              className="flex justify-center py-1"
              title="Addis Ababa Time: East Africa Time (UTC+3)"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            </div>
          )}

          <button
            onClick={logout}
            title={sidebarCollapsed ? "Sign Out" : undefined}
            className={`w-full flex items-center justify-center gap-2 rounded-lg border border-ink/15 py-2.5 text-xs font-medium text-ink transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500 ${
              sidebarCollapsed ? "px-2" : ""
            }`}
          >
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 w-full">
        {/* Floating System Toast Notification */}
        {feedback && (
          <div
            role="status"
            className={`fixed bottom-6 right-6 z-50 flex max-w-md items-center justify-between gap-4 rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 duration-300 ${
              feedback.type === "success"
                ? "border-emerald-500/30 bg-[#161616]/95 text-white shadow-emerald-950/20"
                : "border-red-500/30 bg-[#161616]/95 text-white shadow-red-950/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  feedback.type === "success"
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                    : "bg-red-500/20 text-red-400 ring-1 ring-red-500/40"
                }`}
              >
                {feedback.type === "success" ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  {feedback.type === "success" ? "System Notification" : "System Alert"}
                </p>
                <p className="text-sm font-medium text-white">{feedback.text}</p>
              </div>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        )}

        {/* ================= VIEW 1: APPOINTMENTS ================= */}
        {activeMenu === "appointments" && (
          <div className="space-y-6">
            {/* Header & Quick Metrics */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    className="hidden md:flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-ink/15 text-ink-soft hover:border-ink/40 hover:text-ink hover:bg-ink/5 transition-all shadow-sm"
                    title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.8" />
                      <path d="M9 3v18" strokeWidth="1.8" />
                      {sidebarCollapsed ? (
                        <path d="M14 9l3 3-3 3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      ) : (
                        <path d="M16 15l-3-3 3-3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      )}
                    </svg>
                  </button>
                  <div>
                    <h1 className="font-display text-4xl text-ink md:text-5xl">Appointments</h1>
                    <p className="mt-1 text-sm text-ink-soft">
                      Review and manage customer bookings in Addis Ababa (EAT)
                    </p>
                  </div>
                </div>
              </div>

              {/* Metrics cards (Tabular numbers to avoid layout shift) */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-ink/10 bg-bg-secondary p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wider text-ink-soft font-semibold">
                    Upcoming
                  </p>
                  <p className="font-display mt-2 text-3xl text-ink tabular-nums">{upcomingCount}</p>
                </div>
                <div className="rounded-xl border border-ink/10 bg-bg-secondary p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wider text-ink-soft font-semibold">
                    Today
                  </p>
                  <p className="font-display mt-2 text-3xl text-accent tabular-nums">{todayCount}</p>
                </div>
                <div className="rounded-xl border border-ink/10 bg-bg-secondary p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wider text-ink-soft font-semibold">
                    Pending
                  </p>
                  <p className="font-display mt-2 text-3xl text-amber-500 tabular-nums">{pendingCount}</p>
                </div>
                <div className="rounded-xl border border-ink/10 bg-bg-secondary p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wider text-ink-soft font-semibold">
                    Total Bookings
                  </p>
                  <p className="font-display mt-2 text-3xl text-ink tabular-nums">{appointments.length}</p>
                </div>
              </div>
            </div>

            {/* Filters & Search Controls */}
            <div className="space-y-3 rounded-xl border border-ink/10 bg-bg-secondary p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Status filter pills */}
                <div className="flex flex-wrap gap-1.5">
                  {["upcoming", "pending", "confirmed", "completed", "cancelled", "all"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-150 active:scale-[0.96] ${
                        filter === f
                          ? "bg-dark text-bg shadow-sm"
                          : "border border-ink/15 text-ink-soft hover:border-ink/40 hover:text-ink"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Barber filter selector */}
                <div className="flex items-center gap-2">
                  <label htmlFor="barber-filter" className="text-xs text-ink-soft font-medium">
                    Barber:
                  </label>
                  <select
                    id="barber-filter"
                    value={barberFilter}
                    onChange={(e) => setBarberFilter(e.target.value)}
                    className="rounded-lg border border-ink/20 bg-bg px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="all">All Barbers ({barbers.length})</option>
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search input (16px on mobile prevents automatic viewport zoom) */}
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by customer name, phone number, service, or barber..."
                  className="w-full rounded-lg border border-ink/15 bg-bg py-2 pl-9 pr-4 text-base sm:text-xs text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none"
                />
                <svg
                  className="absolute left-3 top-2.5 h-4 w-4 text-ink-soft"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-2.5 text-xs text-ink-soft hover:text-ink"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Results count label */}
            <div className="flex items-center justify-between text-xs text-ink-soft">
              <span>
                Showing {filteredAppointments.length} of {appointments.length} appointment
                {filteredAppointments.length === 1 ? "" : "s"}
              </span>
              {pending && <span className="text-accent animate-pulse font-medium">Updating...</span>}
            </div>

            {/* Empty State */}
            {filteredAppointments.length === 0 && (
              <div className="rounded-2xl border border-dashed border-ink/20 bg-bg-secondary p-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-ink-soft/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <h3 className="font-display mt-4 text-2xl text-ink">No Bookings Found</h3>
                <p className="mt-1 text-xs text-ink-soft">
                  No appointments match the current filter or search criteria.
                </p>
              </div>
            )}

            {/* ================= BOOKINGS CARD GRID ================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-5">
              {filteredAppointments.map((a) => {
                const [y, m, d] = a.date.split("-").map(Number);
                const eth = formatEthDate(gregorianToEth(y, m, d));

                const statusStyles = {
                  pending:
                    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                  confirmed:
                    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                  completed:
                    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
                }[a.status] ?? "bg-ink/10 text-ink border-ink/20";

                const barberPhoto =
                  a.barber.photoUrl ||
                  `/barbers/${a.barber.name.toLowerCase().replace(/[^a-z]+/g, "")}.jpg`;

                return (
                  <div
                    key={a.id}
                    className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-bg-secondary p-5 shadow-[var(--shadow-card)] transition-all hover:border-ink/25 hover:shadow-md"
                  >
                    <div>
                      {/* Card Top: Customer & Status */}
                      <div className="flex items-start justify-between gap-3 border-b border-ink/10 pb-3.5">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base text-ink truncate">
                            {a.customerName}
                          </h3>
                          <a
                            href={`tel:${a.customerPhone}`}
                            className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                          >
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                              />
                            </svg>
                            <span>{a.customerPhone}</span>
                          </a>
                        </div>

                        {/* Status selector */}
                        <div className="flex-shrink-0">
                          <select
                            value={a.status}
                            disabled={pending}
                            onChange={(e) => setStatus(a.id, e.target.value)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize cursor-pointer focus:outline-none ${statusStyles}`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Service & Price */}
                      <div className="mt-4 flex items-baseline justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display text-xl tracking-wide text-ink truncate">
                            {a.service.name}
                          </p>
                          <p className="text-[11px] text-ink-soft">
                            {a.service.durationMin} mins duration
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-display text-lg text-accent tabular-nums">
                            {a.amountETB?.toLocaleString() ?? a.service.priceETB} ETB
                          </p>
                          <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-ink/10 text-ink-soft">
                            {a.paymentMethod ?? "cash"}
                          </span>
                        </div>
                      </div>

                      {/* Barber & Schedule Info */}
                      <div className="mt-4 space-y-2.5 rounded-xl bg-bg/60 p-3.5 text-xs">
                        {/* Barber */}
                        <div className="flex items-center gap-2.5">
                          <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-accent/40 bg-dark">
                            <Image
                              src={barberPhoto}
                              alt={a.barber.name}
                              fill
                              sizes="28px"
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <span className="text-ink-soft text-[11px]">Barber: </span>
                            <span className="font-semibold text-ink">{a.barber.name}</span>
                          </div>
                        </div>

                        {/* Date & Ethiopian Calendar */}
                        <div className="flex items-center gap-2 text-ink">
                          <svg
                            className="h-4 w-4 text-accent flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="font-medium tabular-nums">{a.date}</span>
                          <span className="text-ink-soft tabular-nums">({eth})</span>
                        </div>

                        {/* Time slot in EAT */}
                        <div className="flex items-center gap-2 text-ink">
                          <svg
                            className="h-4 w-4 text-accent flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="font-medium tabular-nums">
                            {formatTime(a.startMin)} – {formatTime(a.endMin)}
                          </span>
                          <span className="text-[11px] text-ink-soft">EAT</span>
                        </div>
                      </div>

                      {/* Customer Note if present */}
                      {a.notes && (
                        <div className="mt-3 rounded-lg border border-ink/10 bg-bg p-2.5 text-xs text-ink-soft italic">
                          <span className="font-semibold not-italic text-ink text-[11px]">
                            Note:{" "}
                          </span>
                          &ldquo;{a.notes}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Payment Proof & Quick Actions */}
                    <div className="mt-5 border-t border-ink/10 pt-3 flex items-center justify-between gap-2">
                      {/* Payment proof lightbox trigger */}
                      {a.paymentProofUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewProofUrl(a.paymentProofUrl)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span>View Receipt</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-ink-soft">No receipt uploaded</span>
                      )}

                      {/* Quick Status Buttons for pending */}
                      {a.status === "pending" && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setStatus(a.id, "confirmed")}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.96]"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleRejectAppointment(a.id, a.customerName)}
                            className="rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-500 transition-all duration-150 hover:bg-red-500/10 active:scale-[0.96]"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= VIEW 2: MANAGE BARBERS ================= */}
        {activeMenu === "barbers" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="hidden md:flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-ink/15 text-ink-soft hover:border-ink/40 hover:text-ink hover:bg-ink/5 transition-all shadow-sm"
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.8" />
                    <path d="M9 3v18" strokeWidth="1.8" />
                    {sidebarCollapsed ? (
                      <path d="M14 9l3 3-3 3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <path d="M16 15l-3-3 3-3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                </button>
                <div>
                  <h1 className="font-display text-4xl text-ink md:text-5xl">Manage Barbers</h1>
                  <p className="mt-1 text-sm text-ink-soft">
                    {activeBarbersCount} active of {barbers.length} total staff · Add new barbers, update portraits and names, or manage booking availability.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-display text-sm tracking-wider uppercase text-dark transition-all hover:brightness-110 active:scale-95 shadow-sm"
              >
                <span>+ Add Barber</span>
              </button>
            </div>

            {/* Barber Team Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {barbers.map((b) => {
                const photoSrc =
                  b.photoUrl ||
                  `/barbers/${b.name.toLowerCase().replace(/[^a-z]+/g, "")}.jpg`;

                return (
                  <div
                    key={b.id}
                    className={`flex flex-col justify-between rounded-2xl border p-5 transition-shadow shadow-[var(--shadow-card)] ${
                      b.active
                        ? "border-ink/10 bg-bg-secondary hover:border-ink/20"
                        : "border-ink/10 bg-bg/50 opacity-75"
                    }`}
                  >
                    <div>
                      {/* Barber Avatar & Active Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-accent/40 bg-dark shadow-inner">
                          <Image
                            src={photoSrc}
                            alt={b.name}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                            b.active
                              ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                              : "bg-ink/10 text-ink-soft border border-ink/10"
                          }`}
                        >
                          {b.active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {/* Barber Details */}
                      <div className="mt-4">
                        <h3 className="font-display text-2xl tracking-wide text-ink">{b.name}</h3>
                        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                          {b.specialty || "Master Barber"}
                        </p>
                        {b.bio && (
                          <p className="mt-2 text-xs leading-relaxed text-ink-soft line-clamp-2">
                            {b.bio}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 border-t border-ink/10 pt-2.5 text-xs text-ink-soft">
                        <span>{b._count?.appointments ?? 0} total booking(s)</span>
                      </div>
                    </div>

                    {/* Barber Actions */}
                    <div className="mt-5 flex items-center justify-between gap-2 border-t border-ink/10 pt-3">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleOpenEdit(b)}
                        className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-ink hover:bg-ink/5"
                      >
                        Edit Details & Photo
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleToggleActive(b)}
                          title={b.active ? "Deactivate barber" : "Activate barber"}
                          className="rounded-lg border border-ink/15 px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:border-ink/40 hover:text-ink transition-colors"
                        >
                          {b.active ? "Deactivate" : "Activate"}
                        </button>

                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleDelete(b)}
                          title="Delete or soft-delete barber"
                          className="rounded-lg border border-red-500/20 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 hover:border-red-500/40 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ================= PAYMENT RECEIPT LIGHTBOX MODAL ================= */}
      {previewProofUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewProofUrl(null)}
        >
          <div
            className="relative max-w-xl max-h-[85vh] w-full rounded-2xl border border-ink/20 bg-bg p-5 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink/10 pb-3">
              <h3 className="font-display text-xl text-ink">Payment Receipt / Proof</h3>
              <button
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-ink/10 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <div className="relative mt-4 flex-1 min-h-[350px] w-full overflow-hidden rounded-lg bg-black/5">
              <Image
                src={previewProofUrl}
                alt="Payment receipt proof"
                fill
                sizes="(max-width: 768px) 100vw, 600px"
                className="object-contain"
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-ink-soft pt-2 border-t border-ink/10">
              <a
                href={previewProofUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline font-semibold"
              >
                Open in Full Tab ↗
              </a>
              <button
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="rounded-lg border border-ink/20 px-4 py-1.5 font-medium text-ink hover:border-ink"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BARBER MODAL (ADD / EDIT) ================= */}
      {isModalOpen && (
        <BarberModal
          barber={editingBarber}
          onClose={() => setIsModalOpen(false)}
          onSuccess={(msg) => {
            setIsModalOpen(false);
            setFeedback({ type: "success", text: msg });
            router.refresh();
          }}
        />
      )}

      {/* ================= SYSTEM CONFIRMATION MODAL ================= */}
      {confirmDialog && (
        <SystemConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          confirmVariant={confirmDialog.confirmVariant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

interface BarberModalProps {
  barber: BarberWithStats | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

function BarberModal({ barber, onClose, onSuccess }: BarberModalProps) {
  const isEditing = !!barber;
  const [name, setName] = useState(barber?.name ?? "");
  const [specialty, setSpecialty] = useState(barber?.specialty ?? "Fades & Design");
  const [bio, setBio] = useState(barber?.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(barber?.photoUrl ?? "");
  const [active, setActive] = useState(barber?.active ?? true);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload photo");
      }

      setPhotoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error uploading photo");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please provide the barber's name.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && barber) {
        const res = await updateBarber(barber.id, {
          name,
          specialty,
          bio,
          photoUrl: photoUrl || null,
          active,
        });
        if (!res.ok) throw new Error(res.error ?? "Failed to update barber");
        onSuccess(`Updated ${name} successfully.`);
      } else {
        const res = await createBarber({
          name,
          specialty,
          bio,
          photoUrl: photoUrl || null,
        });
        if (!res.ok) throw new Error(res.error ?? "Failed to create barber");
        onSuccess(`Added ${name} to the team.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSubmitting(false);
    }
  }

  const previewPhoto =
    photoUrl ||
    (isEditing
      ? `/barbers/${barber?.name.toLowerCase().replace(/[^a-z]+/g, "")}.jpg`
      : "/barbers/kaleb.jpg");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-ink/15 bg-bg p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/10 pb-4">
          <h2 className="font-display text-2xl text-ink">
            {isEditing ? `Edit Barber: ${barber?.name}` : "Add New Barber"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-ink/10 hover:text-ink text-sm"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Photo Section with live preview & upload */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Profile Photo
            </label>
            <div className="mt-2 flex items-center gap-4">
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-accent/50 bg-dark shadow-sm">
                <Image
                  src={previewPhoto}
                  alt="Barber photo preview"
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>

              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg border border-ink/20 bg-bg-secondary px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-ink hover:bg-ink/5"
                  >
                    {uploading ? "Uploading..." : "Upload New Photo"}
                  </button>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl("")}
                      className="text-xs text-ink-soft underline hover:text-red-500"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-ink-soft">JPG, PNG, or WebP up to 5 MB.</p>
              </div>
            </div>

            {/* Direct photo URL input fallback */}
            <div className="mt-3">
              <label className="block text-[11px] text-ink-soft">
                Or enter image path / cloud URL:
              </label>
              <input
                type="text"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="/barbers/kaleb.jpg or https://..."
                className="mt-1 w-full rounded-lg border border-ink/15 bg-bg px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Abel K."
              className="mt-1.5 w-full rounded-lg border border-ink/15 bg-bg px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>

          {/* Specialty */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Specialty
            </label>
            <input
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g. Fades & Design, Classic Cuts, Beard Sculpt"
              className="mt-1.5 w-full rounded-lg border border-ink/15 bg-bg px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Bio / Experience
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short bio or background (optional)"
              className="mt-1.5 w-full rounded-lg border border-ink/15 bg-bg px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none resize-none"
            />
          </div>

          {/* Active status */}
          {isEditing && (
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-ink/20 text-accent focus:ring-accent"
                />
                <span>Active (available for customer bookings)</span>
              </label>
            </div>
          )}

          {/* Footer buttons */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-ink/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-ink/20 px-4 py-2 text-xs font-medium text-ink hover:border-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="rounded-lg bg-accent px-5 py-2 font-display text-sm tracking-wider uppercase text-dark transition-all hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Add Barber"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "warning" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

function SystemConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-ink/15 bg-bg p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${
              confirmVariant === "danger"
                ? "bg-red-500/15 text-red-500 ring-1 ring-red-500/30"
                : "bg-accent/15 text-accent ring-1 ring-accent/30"
            }`}
          >
            {confirmVariant === "danger" ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </div>

          <div className="flex-1">
            <h3 className="font-display text-2xl tracking-wide text-ink">{title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-ink/10 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-ink/20 px-4 py-2 text-xs font-medium text-ink hover:border-ink transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all shadow-sm ${
              confirmVariant === "danger"
                ? "bg-red-600 text-white hover:bg-red-700 active:scale-95"
                : "bg-accent text-dark hover:brightness-110 active:scale-95"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
