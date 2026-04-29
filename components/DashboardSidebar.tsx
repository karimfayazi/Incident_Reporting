"use client";

import Link from "next/link";
import { useState } from "react";

const sidebarItems = [
  { label: "Overview", icon: "overview", href: "/" },
  { label: "Incidents", icon: "incidents", href: "/" },
  { label: "Reports", icon: "reports", href: "/" },
  { label: "Alerts", icon: "alerts", href: "/" },
  { label: "Export Data", icon: "team", href: "/export-data" },
  { label: "Setting", icon: "settings", href: "/setting" }
] as const;

type SidebarIconName = (typeof sidebarItems)[number]["icon"] | "menu";

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const paths: Record<SidebarIconName, React.ReactNode> = {
    overview: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10.5V20h5v-5h4v5h5v-9.5" />
      </>
    ),
    incidents: (
      <>
        <path d="M12 3 2.8 19h18.4L12 3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    reports: (
      <>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h4" />
        <path d="M9.5 13h5" />
        <path d="M9.5 17h5" />
      </>
    ),
    alerts: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </>
    ),
    team: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    settings: (
      <>
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1 .6 1.8 1.8 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.8 1.8 0 0 0 8.6 19.4a1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-.6-1 1.8 1.8 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.8 1.8 0 0 0 4.6 8.6a1.8 1.8 0 0 0-.36-1.98l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.8 1.8 0 0 0 9 4.6a1.8 1.8 0 0 0 1-.6 1.8 1.8 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.8 1.8 0 0 0 15.4 4.6a1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.8 1.8 0 0 0 19.4 9c.2.37.5.69.9.9.32.17.68.25 1.05.24H21a2 2 0 1 1 0 4h-.09A1.8 1.8 0 0 0 19.4 15Z" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    )
  };

  return (
    <svg className="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

type DashboardSidebarProps = {
  activeLabel?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
};

export function DashboardSidebar({ activeLabel = "Overview", isExpanded, onToggle }: DashboardSidebarProps) {
  const [localExpanded, setLocalExpanded] = useState(true);
  const expanded = isExpanded ?? localExpanded;
  const toggleSidebar = onToggle ?? (() => setLocalExpanded((current) => !current));

  return (
    <aside className="sidebar" aria-label="Dashboard navigation">
      <div className="sidebar__top">
        <button
          className="sidebar__toggle"
          type="button"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={expanded}
          onClick={toggleSidebar}
        >
          <SidebarIcon name="menu" />
        </button>
      </div>

      <nav className="sidebar__nav">
        <span className="sidebar__section">Menu</span>
        {sidebarItems.map((item) => (
          <Link
            className={`sidebar__item ${item.label === activeLabel ? "sidebar__item--active" : ""}`}
            href={item.href}
            key={item.label}
            aria-current={item.label === activeLabel ? "page" : undefined}
            title={item.label}
          >
            <SidebarIcon name={item.icon} />
            <span className="sidebar__item-text">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
