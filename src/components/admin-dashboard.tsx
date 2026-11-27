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
  fetchBarberSchedule,
  setBarberDaySchedule,
  deleteBarberDaySchedule,
  copyBarberScheduleWeek,
  type BarberScheduleEntry,
} from "@/lib/actions";
import { formatTime, todayEat, addDays, OPEN_MIN, CLOSE_MIN } from "@/lib/time";
import { formatEthDate, gregorianToEth } from "@/lib/ethiopian";
import {
  Calendar,
  Clock,
  Users,
  LogOut,
  Search,
  Phone,
  Check,
  X,
  Image as ImageIcon,
  ClipboardList,
  AlertTriangle,
  Info,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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

  // Schedule modal state
  const [schedulingBarber, setSchedulingBarber] = useState<BarberWithStats | null>(null);

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
      {/* ================= DESKTOP SIDEBAR (md and up) ================= */}
      <aside
        className={`flex flex-col justify-between border-b md:border-b-0 md:border-r border-ink/10 bg-bg-secondary transition-all duration-300 md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:shrink-0 md:z-20 md:overflow-y-auto
          /* mobile: horizontal strip */
          w-full px-4 py-2.5 md:py-0 md:px-0
          ${sidebarCollapsed ? "md:w-20 md:p-3" : "md:w-64 md:p-5"}
        `}
      >
        {/* ---- MOBILE LAYOUT (horizontal) ---- */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setActiveMenu("appointments"); setFeedback(null); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeMenu === "appointments" ? "bg-dark text-bg shadow-sm" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <span>Appointments</span>
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                activeMenu === "appointments" ? "bg-accent text-dark" : pendingCount > 0 ? "bg-amber-500/20 text-amber-600 font-bold" : "bg-ink/10 text-ink"
              }`}>
                {pendingCount > 0 ? `${pendingCount} new` : appointments.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveMenu("barbers"); setFeedback(null); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeMenu === "barbers" ? "bg-dark text-bg shadow-sm" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <span>Barbers</span>
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                activeMenu === "barbers" ? "bg-accent text-dark" : "bg-ink/10 text-ink"
              }`}>
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

        {/* ---- DESKTOP LAYOUT (vertical) ---- */}
        <div className="hidden md:block">
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
                  <Calendar className="h-5 w-5 flex-shrink-0" />
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
                  <Users className="h-5 w-5 flex-shrink-0" />
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

        {/* Sidebar Footer — desktop only */}
        <div className="hidden md:block border-t border-ink/10 pt-5 space-y-4">
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
            <LogOut className="h-4 w-4 flex-shrink-0" />
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
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
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
          <div className="space-y-4">
            {/* Header & Compact Stats */}
            <div>
              <h1 className="font-display text-4xl text-ink md:text-5xl">Appointments</h1>

              {/* 2-tile compact stats row */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-bg-secondary px-3 py-2.5 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Today</span>
                  <span className="font-display text-2xl text-accent tabular-nums">{todayCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-bg-secondary px-3 py-2.5 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Total</span>
                  <span className="font-display text-2xl text-ink tabular-nums">{appointments.length}</span>
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
                  placeholder="Search name or phone"
                  className="w-full rounded-lg border border-ink/15 bg-bg py-2 pl-9 pr-4 text-base sm:text-xs text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-soft" />
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
                <ClipboardList className="mx-auto h-12 w-12 text-ink-soft/50" />
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
                    "bg-amber-500/15 text-amber-800 border-amber-500/40 font-bold",
                  confirmed:
                    "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
                  completed:
                    "bg-blue-500/10 text-blue-600 border-blue-500/30",
                  cancelled: "bg-red-500/10 text-red-600 border-red-500/30",
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
                      {/* Card Top: Date/Time + Status */}
                      <div className="flex items-start justify-between gap-3 border-b border-ink/10 pb-3">
                        <div className="min-w-0">
                          {/* Date & time — what admin looks for first */}
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-ink tabular-nums">
                            <Calendar className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                            <span>{a.date}</span>
                            <span className="text-ink-soft">·</span>
                            <Clock className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                            <span>{formatTime(a.startMin)} – {formatTime(a.endMin)}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-ink-soft tabular-nums">({eth})</p>
                        </div>
                        <select
                          value={a.status}
                          disabled={pending}
                          onChange={(e) => setStatus(a.id, e.target.value)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize cursor-pointer focus:outline-none flex-shrink-0 ${statusStyles}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* Customer name + phone */}
                      <div className="mt-3">
                        <h3 className="font-semibold text-base text-ink truncate">{a.customerName}</h3>
                        <a
                          href={`tel:${a.customerPhone}`}
                          className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          <span>{a.customerPhone}</span>
                        </a>
                      </div>

                      {/* Service & Price */}
                      <div className="mt-3 flex items-baseline justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display text-xl tracking-wide text-ink truncate">{a.service.name}</p>
                          <p className="text-[11px] text-ink-soft">{a.service.durationMin} mins</p>
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

                      {/* Barber */}
                      <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-bg/60 px-3 py-2 text-xs">
                        <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-accent/40 bg-dark">
                          <Image src={barberPhoto} alt={a.barber.name} fill sizes="28px" className="object-cover" />
                        </div>
                        <span className="text-ink-soft">Barber:</span>
                        <span className="font-semibold text-ink">{a.barber.name}</span>
                      </div>

                      {/* Note */}
                      {a.notes && (
                        <div className="mt-3 rounded-lg border border-ink/10 bg-bg p-2.5 text-xs text-ink-soft italic">
                          <span className="font-semibold not-italic text-ink text-[11px]">Note: </span>
                          &ldquo;{a.notes}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Receipt + Action buttons */}
                    <div className="mt-4 border-t border-ink/10 pt-3.5 space-y-3">
                      {a.paymentProofUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewProofUrl(a.paymentProofUrl)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span>View Receipt</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-ink-soft">No receipt uploaded</span>
                      )}

                      {a.status === "pending" && (
                        <div className="flex gap-3">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setStatus(a.id, "confirmed")}
                            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-40"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleRejectAppointment(a.id, a.customerName)}
                            className="flex-1 rounded-xl border border-red-400/40 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-500/10 active:scale-[0.97] disabled:opacity-40"
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
              <div>
                <h1 className="font-display text-4xl text-ink md:text-5xl">Manage Barbers</h1>
                <p className="mt-1 text-sm text-ink-soft">
                  {activeBarbersCount} active of {barbers.length} total staff · Add new barbers, update portraits and names, or manage booking availability.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-display text-sm tracking-wider uppercase text-dark transition-all hover:brightness-110 active:scale-95 shadow-sm"
              >
                <span>+ Add Barber</span>
              </button>
            </div>

            {/* Unscheduled barbers warning */}
            {(() => {
              const activeBarbers = barbers.filter((b) => b.active);
              if (activeBarbers.length === 0) return null;
              return (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800">Schedule reminder</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Make sure each barber has upcoming days scheduled. Unscheduled barbers are visible to clients but cannot be booked.
                      Use the <span className="font-bold">Schedule</span> button on each card to assign working days.
                    </p>
                  </div>
                </div>
              );
            })()}

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
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setSchedulingBarber(b)}
                        className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:border-accent hover:bg-accent/5 flex items-center gap-1.5"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        Schedule
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

      {/* ================= SCHEDULE MODAL ================= */}
      {schedulingBarber && (
        <BarberScheduleModal
          barber={schedulingBarber}
          onClose={() => setSchedulingBarber(null)}
          onSuccess={(msg) => {
            setFeedback({ type: "success", text: msg });
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
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <Info className="h-6 w-6" />
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

// ============================================================
// BARBER SCHEDULE MODAL
// ============================================================

interface BarberScheduleModalProps {
  barber: BarberWithStats;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function BarberScheduleModal({ barber, onClose, onSuccess }: BarberScheduleModalProps) {
  const [pending, startTransition] = useTransition();
  const [entries, setEntries] = useState<BarberScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const today = todayEat();

  const weekStart = addDays(today, weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekLabel = (() => {
    const fmt = (s: string) => {
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 12));
      return `${dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ${d}`;
    };
    return `${fmt(weekDays[0])} – ${fmt(weekDays[6])}`;
  })();

  // Load schedule for visible week
  useEffect(() => {
    setLoading(true);
    fetchBarberSchedule(barber.id, weekDays[0], weekDays[6])
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [barber.id, weekOffset]);

  function getEntry(date: string): BarberScheduleEntry | undefined {
    return entries.find((e) => e.date === date);
  }

  function getDayMeta(dtStr: string) {
    const [y, m, d] = dtStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    return {
      weekday: dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      day: d,
      month: dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    };
  }

  function toggleDay(date: string) {
    const entry = getEntry(date);
    const isCurrentlyAvailable = entry?.available ?? false;

    startTransition(async () => {
      if (isCurrentlyAvailable) {
        // Mark as day off
        const res = await setBarberDaySchedule(barber.id, date, { available: false });
        if (res.ok) {
          setEntries((prev) => {
            const existing = prev.find((e) => e.date === date);
            if (existing) return prev.map((e) => e.date === date ? { ...e, available: false } : e);
            return [...prev, res.entry];
          });
        }
      } else if (entry && !entry.available) {
        // Re-enable — delete the off entry (reverts to default available)
        const res = await deleteBarberDaySchedule(barber.id, date);
        if (res.ok) setEntries((prev) => prev.filter((e) => e.date !== date));
      } else {
        // No entry = unscheduled, schedule with default hours
        const res = await setBarberDaySchedule(barber.id, date, { available: true, startMin: OPEN_MIN, endMin: CLOSE_MIN });
        if (res.ok) {
          setEntries((prev) => [...prev.filter((e) => e.date !== date), res.entry]);
        }
      }
      onSuccess(`${barber.name}'s schedule updated.`);
    });
  }

  async function handleCopyWeek() {
    startTransition(async () => {
      const res = await copyBarberScheduleWeek(barber.id, weekDays[0]);
      if (res.ok) {
        onSuccess(`Copied ${res.copied} day(s) to next week for ${barber.name}.`);
        setWeekOffset((w) => w + 1);
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-ink/15 bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
          <div>
            <h2 className="font-display text-2xl text-ink">{barber.name} — Schedule</h2>
            <p className="text-xs text-ink-soft mt-0.5">Click a day to toggle availability. No entry = fully available by default.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-soft hover:bg-ink/10 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-ink/10">
          <button type="button" onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} disabled={weekOffset === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/15 text-ink disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-ink">{weekLabel}</span>
          <button type="button" onClick={() => setWeekOffset((w) => w + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/15 text-ink">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day grid */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8 text-sm text-ink-soft">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent mr-2 inline-block" />
              Loading schedule…
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((dtStr) => {
                const meta = getDayMeta(dtStr);
                const entry = getEntry(dtStr);
                const isPast = dtStr < today;
                // No entry = available by default; entry with available=true = scheduled; entry with available=false = day off
                const isScheduled = !entry || entry.available;
                const isDayOff = entry && !entry.available;

                return (
                  <button
                    key={dtStr}
                    type="button"
                    disabled={pending || isPast}
                    onClick={() => toggleDay(dtStr)}
                    className={`flex flex-col items-center rounded-xl py-3 px-1 text-center transition-all border ${
                      isPast
                        ? "opacity-30 cursor-not-allowed border-ink/10 bg-bg-secondary"
                        : isScheduled && entry
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                        : isDayOff
                        ? "border-red-400/30 bg-red-500/8 text-red-600 hover:bg-red-500/15"
                        : "border-ink/15 bg-bg-secondary text-ink-soft hover:border-accent hover:text-accent"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider">{meta.weekday}</span>
                    <span className="font-display text-xl mt-1">{meta.day}</span>
                    <span className="text-[9px] font-semibold mt-1 uppercase">
                      {isPast ? "past" : isScheduled && entry ? "on" : isDayOff ? "off" : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500/40" /> Scheduled (on)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500/15 border border-red-400/30" /> Day off</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-bg-secondary border border-ink/15" /> Default (available)</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-ink/10 px-6 py-4">
          <button type="button" onClick={handleCopyWeek} disabled={pending}
            className="rounded-lg border border-ink/20 px-4 py-2 text-xs font-semibold text-ink hover:border-ink/40 disabled:opacity-40 transition-colors">
            Copy week → next
          </button>
          <button type="button" onClick={onClose}
            className="rounded-lg bg-dark px-5 py-2 text-xs font-semibold text-bg hover:opacity-85 transition-opacity">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
