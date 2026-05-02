"use client";

import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { SessionUser } from "@/lib/session";

export type AppSidebarProps = {
  user: SessionUser;
  active: "Dashboard" | "Main Dashboard" | "Export Data" | "Incidents" | "User Management";
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onMobileToggle?: () => void;
};

const menuByRole = {
  field_volunteer: [{ label: "Incidents", href: "/record-incident" }],
  ntf_volunteer: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Incidents", href: "/dashboard#incidents" }
  ],
  admin: [
    { label: "Main Dashboard", href: "/dashboard" },
    { label: "Export Data", href: "/export-data" },
    { label: "User Management", href: "/admin/users" },
    { label: "Incidents", href: "/dashboard#incidents" }
  ]
} satisfies Record<SessionUser["role"], Array<{ label: AppSidebarProps["active"]; href: string }>>;

export function AppSidebar({ user, active, collapsed, onToggle, onMobileToggle }: AppSidebarProps) {
  return (
    <>
      {/* Mobile hamburger — only visible on small screens */}
      <button
        type="button"
        className="mobile-menu-btn"
        onClick={onMobileToggle}
        aria-label="Toggle menu"
      >
        <Menu size={22} />
      </button>

      <aside className="sidebar auth-sidebar" aria-label="Application navigation">
        <div className="sidebar__top">
          <div className="sidebar__brand auth-sidebar__brand">
            <span className="sidebar__brand-mark">IR</span>
            <span className="sidebar__brand-text">Incident Reporting</span>
          </div>
          <button
            type="button"
            className="sidebar__toggle"
            onClick={onToggle}
            aria-label="Toggle menu"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="sidebar__nav">
          <span className="sidebar__section">Menu</span>
          {menuByRole[user.role].map((item) => (
            <Link
              className={`sidebar__item ${item.label === active ? "sidebar__item--active" : ""}`}
              href={item.href}
              key={item.label}
              aria-current={item.label === active ? "page" : undefined}
            >
              <span className="sidebar__item-text">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="auth-sidebar__user">
          <span>{user.fullName}</span>
          <small>{user.role.replace("_", " ")}</small>
        </div>
      </aside>
    </>
  );
}
