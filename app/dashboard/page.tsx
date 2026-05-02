import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/DashboardClient";
import { LogoutButton } from "@/components/LogoutButton";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <WorkspaceShell user={user} active={user.role === "admin" ? "Main Dashboard" : "Dashboard"}>
      <main className="dashboard auth-main">
        <section className="hero auth-hero management-hero" aria-labelledby="dashboard-title">
          <div>
            <p className="brand__eyebrow">Incident Reporting</p>
            <h2 id="dashboard-title">Dashboard</h2>
            <p>
              Monitor incident activity, track severity trends, and view real-time operational insights across all regions.
            </p>
          </div>
          <LogoutButton />
        </section>

        <DashboardClient />
      </main>
    </WorkspaceShell>
  );
}
