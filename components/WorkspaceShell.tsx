"use client";

import { useCallback, useEffect, useState } from "react";
import { AppSidebar, type AppSidebarProps } from "@/components/AppSidebar";

type WorkspaceShellProps = AppSidebarProps & {
  children: React.ReactNode;
};

const STORAGE_KEY = "sidebar-collapsed";

export function WorkspaceShell({ user, active, children }: WorkspaceShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { sessionStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  const toggleMobile = useCallback(() => setMobileOpen((prev) => !prev), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const workspaceClass = [
    "workspace",
    "auth-workspace",
    collapsed ? "workspace--collapsed" : "",
    mobileOpen ? "workspace--mobile-open" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={workspaceClass}>
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={closeMobile} aria-hidden="true" />
      )}
      <AppSidebar
        user={user}
        active={active}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileToggle={toggleMobile}
      />
      {children}
    </div>
  );
}
