"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { LogoutButton } from "@/components/LogoutButton";
import type { SessionUser } from "@/lib/session";

const roles = ["field_volunteer", "ntf_volunteer", "admin"] as const;

const userFormSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters.").max(100),
  password: z.string().max(255).optional(),
  fullName: z.string().trim().min(2, "Full name is required.").max(150),
  phone: z.string().trim().max(50).optional(),
  role: z.enum(roles),
  isActive: z.boolean()
});

type UserFormValues = z.infer<typeof userFormSchema>;

type ApiUser = {
  user_id: number;
  username: string;
  full_name: string | null;
  phone: string | null;
  role: (typeof roles)[number];
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type Filters = {
  username: string;
  role: string;
  status: string;
};

const defaultValues: UserFormValues = {
  username: "",
  password: "",
  fullName: "",
  phone: "",
  role: "field_volunteer",
  isActive: true
};

function formatRole(role: string) {
  return role.replace(/_/g, " ");
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  return fallback;
}

export function AdminUsersClient({ currentUser }: { currentUser: SessionUser }) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [filters, setFilters] = useState<Filters>({ username: "", role: "", status: "" });
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    return params.toString();
  }, [filters]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/users${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store"
      });
      const data = (await response.json().catch(() => ({}))) as { users?: ApiUser[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Unable to load users.");
      }

      setUsers(data.users ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load users.");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function startCreate() {
    setEditingUser(null);
    reset(defaultValues);
  }

  function startEdit(user: ApiUser) {
    setEditingUser(user);
    reset({
      username: user.username,
      password: "",
      fullName: user.full_name || "",
      phone: user.phone || "",
      role: user.role,
      isActive: Boolean(user.is_active)
    });
  }

  async function onSubmit(values: UserFormValues) {
    if (!editingUser && !values.password?.trim()) {
      setError("password", { message: "Password is required for new users." });
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        ...values,
        password: values.password?.trim() || undefined
      };
      const response = await fetch(editingUser ? `/api/admin/users/${editingUser.user_id}` : "/api/admin/users", {
        method: editingUser ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Unable to save user."));
      }

      toast.success(editingUser ? "User updated." : "User created.");
      startCreate();
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save user.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deactivateUser(user: ApiUser) {
    if (!window.confirm(`Deactivate ${user.username}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${user.user_id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Unable to deactivate user."));
      }

      toast.success("User deactivated.");
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to deactivate user.");
    }
  }

  return (
    <main className="dashboard auth-main admin-users-main">
      <section className="hero auth-hero" aria-labelledby="users-title">
        <div>
          <p className="brand__eyebrow">Admin</p>
          <h2 id="users-title">User Management</h2>
          <p>Manage access for field volunteers, NTF volunteers, and administrators.</p>
        </div>
        <div className="admin-users-main__actions">
          <span className="admin-user-chip">Signed in as {currentUser.fullName}</span>
          <LogoutButton />
        </div>
      </section>

      <section className="panel user-form-panel" aria-labelledby="user-form-title">
        <div className="panel__header">
          <h3 id="user-form-title">{editingUser ? `Edit ${editingUser.username}` : "Add New User"}</h3>
          <p>Passwords are stored as plain text for development only. Replace this with hashing before production use.</p>
        </div>

        <form className="admin-user-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" disabled={Boolean(editingUser)} {...register("username")} />
            {errors.username ? <p className="field-error">{errors.username.message}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="password">{editingUser ? "Reset Password" : "Password"}</label>
            <input id="password" type="password" {...register("password")} />
            {errors.password ? <p className="field-error">{errors.password.message}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="fullName">Full Name</label>
            <input id="fullName" {...register("fullName")} />
            {errors.fullName ? <p className="field-error">{errors.fullName.message}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" placeholder="0346-9750336" {...register("phone")} />
            {errors.phone ? <p className="field-error">{errors.phone.message}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" {...register("role")}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {formatRole(role)}
                </option>
              ))}
            </select>
            {errors.role ? <p className="field-error">{errors.role.message}</p> : null}
          </div>

          <label className="checkbox-field">
            <input type="checkbox" {...register("isActive")} />
            <span>Active user</span>
          </label>

          <div className="form-actions admin-user-form__actions">
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : editingUser ? "Update User" : "Create User"}
            </button>
            <button className="secondary-button" type="button" onClick={startCreate}>
              Clear
            </button>
          </div>
        </form>
      </section>

      <section className="panel" aria-labelledby="users-table-title">
        <div className="panel__header export-panel__header">
          <div>
            <h3 id="users-table-title">Users</h3>
            <p>Search by username or full name, then filter by role or active status.</p>
          </div>
          <button className="secondary-button" type="button" onClick={loadUsers} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="user-filters">
          <div className="field">
            <label htmlFor="filterUsername">Search</label>
            <input
              id="filterUsername"
              value={filters.username}
              onChange={(event) => setFilters((current) => ({ ...current, username: event.target.value }))}
              placeholder="Username or full name"
            />
          </div>
          <div className="field">
            <label htmlFor="filterRole">Role</label>
            <select
              id="filterRole"
              value={filters.role}
              onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}
            >
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {formatRole(role)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filterStatus">Status</label>
            <select
              id="filterStatus"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="incidents-table users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.user_id}>
                  <td>{user.username}</td>
                  <td>{user.full_name || "N/A"}</td>
                  <td>{user.phone || "N/A"}</td>
                  <td>{formatRole(user.role)}</td>
                  <td>
                    <span className={`pill ${user.is_active ? "pill--active" : "pill--inactive"}`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="secondary-button" type="button" onClick={() => startEdit(user)}>
                        Edit
                      </button>
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => deactivateUser(user)}
                        disabled={!user.is_active}
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">{isLoading ? "Loading users..." : "No users found."}</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
