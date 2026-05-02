import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getUser } from "@/lib/auth";

export default async function AdminDashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/");
  }

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <WorkspaceShell user={user} active="Main Dashboard">
      <main className="dashboard auth-main">
        <section className="hero auth-hero" aria-labelledby="admin-dashboard-title">
          <div>
            <p className="brand__eyebrow">Admin Dashboard</p>
            <h2 id="admin-dashboard-title">Welcome, {user.fullName}</h2>
            <p>Manage users, review incidents, and access administrative tools from this role-protected area.</p>
          </div>
          <LogoutButton />
        </section>

        <section className="summary-grid dashboard-user-grid" aria-label="Admin account information">
          <article className="summary-card">
            <span>Username</span>
            <strong>{user.username}</strong>
          </article>
          <article className="summary-card">
            <span>Role</span>
            <strong>admin</strong>
          </article>
          <article className="summary-card">
            <span>User Management</span>
            <strong>Enabled</strong>
          </article>
        </section>
      </main>
    </WorkspaceShell>
  );
}
