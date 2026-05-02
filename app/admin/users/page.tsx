import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getUser } from "@/lib/auth";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminUsersPage() {
  const user = await getUser();

  if (!user) {
    redirect("/");
  }

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <WorkspaceShell user={user} active="User Management">
      <AdminUsersClient currentUser={user} />
    </WorkspaceShell>
  );
}
