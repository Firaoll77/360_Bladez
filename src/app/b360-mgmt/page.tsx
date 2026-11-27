import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin, fetchAllAppointments, fetchAllBarbersAdmin } from "@/lib/actions";
import { AdminLogin } from "@/components/admin-login";
import { AdminDashboard } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Management — 360_Bladez",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ManagementPage() {
  if (!(await isAdmin())) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-4xl text-ink">Staff Access</h1>
          <div className="mt-6">
            <AdminLogin />
          </div>
          <p className="mt-6 text-center text-xs text-ink-soft">
            <Link href="/" className="hover:text-ink transition-colors">← Back to site</Link>
          </p>
        </div>
      </div>
    );
  }

  const [appointments, barbers] = await Promise.all([
    fetchAllAppointments(),
    fetchAllBarbersAdmin(),
  ]);

  return (
    <div className="min-h-screen bg-bg pt-16">
      <AdminDashboard appointments={appointments} barbers={barbers} />
    </div>
  );
}
