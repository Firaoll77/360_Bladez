import type { Metadata } from "next";
import { isAdmin, fetchAllAppointments, fetchAllBarbersAdmin } from "@/lib/actions";
import { AdminLogin } from "@/components/admin-login";
import { AdminDashboard } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — 360_Bladez",
};

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <section className="bg-bg">
        <div className="mx-auto max-w-sm px-6 py-24">
          <h1 className="font-display text-4xl text-ink">Staff Login</h1>
          <div className="mt-8">
            <AdminLogin />
          </div>
        </div>
      </section>
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
