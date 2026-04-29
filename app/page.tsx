"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

type Kpis = {
  totalIncidents: number;
  todayIncidents: number;
  monthlyIncidentCount: number;
  criticalIncidents: number;
  highSeverityIncidents: number;
  activeIncidents: number;
};

type ChartPoint = {
  name: string;
  value: number;
};

type TrendPoint = {
  month: string;
  incidents: number;
};

type TeamWorkload = {
  team: string;
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
  Total: number;
};

type IncidentRow = {
  IncidentID: number;
  VolunteerName?: string | null;
  IncidentCategory: string | null;
  RegionalCouncil: string | null;
  LocalCouncil: string | null;
  IncidentSeverity: string | null;
  ResponsibleTeam?: string | null;
  CreatedDate: string;
};

type DashboardData = {
  success: boolean;
  message?: string;
  kpis: Kpis;
  monthComparison: {
    currentMonth: number;
    previousMonth: number;
    percentChange: number;
    status: string;
  };
  categoryTotals: ChartPoint[];
  severityTotals: ChartPoint[];
  regionalTotals: ChartPoint[];
  localCouncilTotals: ChartPoint[];
  incidentTypeTotals: ChartPoint[];
  incidentStatusTotals: ChartPoint[];
  monthlyTrend: TrendPoint[];
  teamWorkload: TeamWorkload[];
  criticalHighIncidents: IncidentRow[];
  recentIncidents: IncidentRow[];
  filterOptions: {
    regionalCouncils: string[];
    localCouncils: string[];
    localCouncilsByRegion: Record<string, string[]>;
    categories: string[];
    severities: string[];
    incidentTypes: string[];
    responsibleTeams: string[];
  };
  insights: string[];
};

type Filters = {
  dateFrom: string;
  dateTo: string;
  regionalCouncil: string;
  localCouncil: string;
  incidentCategory: string;
  incidentSeverity: string;
  incidentType: string;
  responsibleTeam: string;
};

const emptyKpis: Kpis = {
  totalIncidents: 0,
  todayIncidents: 0,
  monthlyIncidentCount: 0,
  criticalIncidents: 0,
  highSeverityIncidents: 0,
  activeIncidents: 0
};

const emptyDashboard: DashboardData = {
  success: false,
  kpis: emptyKpis,
  monthComparison: {
    currentMonth: 0,
    previousMonth: 0,
    percentChange: 0,
    status: "Stable"
  },
  categoryTotals: [],
  severityTotals: [],
  regionalTotals: [],
  localCouncilTotals: [],
  incidentTypeTotals: [],
  incidentStatusTotals: [],
  monthlyTrend: [],
  teamWorkload: [],
  criticalHighIncidents: [],
  recentIncidents: [],
  filterOptions: {
    regionalCouncils: [],
    localCouncils: [],
    localCouncilsByRegion: {},
    categories: [],
    severities: [],
    incidentTypes: [],
    responsibleTeams: []
  },
  insights: []
};

const defaultFilters: Filters = {
  dateFrom: "",
  dateTo: "",
  regionalCouncil: "",
  localCouncil: "",
  incidentCategory: "",
  incidentSeverity: "",
  incidentType: "",
  responsibleTeam: ""
};

const sidebarItems = [
  { label: "Overview", icon: "overview", active: true },
  { label: "Incidents", icon: "incidents", active: false },
  { label: "Reports", icon: "reports", active: false },
  { label: "Alerts", icon: "alerts", active: false },
  { label: "Export Data", icon: "team", active: false, href: "/export-data" },
  { label: "Setting", icon: "settings", active: false, href: "/setting" }
] as const;

const severityColors: Record<string, string> = {
  Critical: "#7f1d1d",
  High: "#dc2626",
  Low: "#fecaca",
  Medium: "#16a34a"
};
const chartColors = ["#7f1d1d", "#dc2626", "#fecaca", "#16a34a"];

const INCIDENT_STATUS_ORDER = ["Open", "In Progress", "Closed"] as const;

const incidentStatusColors: Record<string, string> = {
  Open: "#16a34a",
  "In Progress": "#d97706",
  Closed: "#475569"
};

function normalizeIncidentStatusLabel(raw: string | null | undefined) {
  if (raw == null || String(raw).trim() === "") {
    return "Open";
  }

  const trimmed = String(raw).trim();
  const lower = trimmed.toLowerCase();

  if (lower === "open") {
    return "Open";
  }

  if (lower === "closed") {
    return "Closed";
  }

  if (lower === "in progress" || lower === "inprogress" || lower === "in_progress") {
    return "In Progress";
  }

  return trimmed;
}

function buildIncidentStatusPieData(rows: ChartPoint[]): ChartPoint[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const label = normalizeIncidentStatusLabel(row.name);
    counts.set(label, (counts.get(label) ?? 0) + Number(row.value));
  }

  const ordered: ChartPoint[] = INCIDENT_STATUS_ORDER.map((name) => ({
    name,
    value: counts.get(name) ?? 0
  })).filter((point) => point.value > 0);

  const standard = new Set<string>(INCIDENT_STATUS_ORDER);

  for (const [name, value] of counts) {
    if (!standard.has(name) && value > 0) {
      ordered.push({ name, value });
    }
  }

  return ordered;
}

type SidebarIconName = (typeof sidebarItems)[number]["icon"] | "menu";
type KpiIconName = "report" | "calendar" | "monthly" | "critical" | "warning" | "active";

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const paths: Record<SidebarIconName, ReactNode> = {
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

function KpiIcon({ name }: { name: KpiIconName }) {
  const paths: Record<KpiIconName, ReactNode> = {
    report: (
      <>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h4" />
        <path d="M9.5 13h5" />
        <path d="M9.5 17h5" />
      </>
    ),
    calendar: (
      <>
        <path d="M7 3v4" />
        <path d="M17 3v4" />
        <path d="M4 8h16" />
        <path d="M5 5h14v16H5z" />
        <path d="M12 12v4l3 1.5" />
      </>
    ),
    monthly: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-5" />
        <path d="M12 16V8" />
        <path d="M16 16v-7" />
      </>
    ),
    critical: (
      <>
        <path d="M12 3 2.8 19h18.4L12 3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </>
    ),
    active: (
      <>
        <path d="M3 7h7l2 2h9v10H3z" />
        <path d="M7 14h3l2-4 3 7 2-3h2" />
      </>
    )
  };

  return (
    <svg className="kpi-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : "N/A";
}

function getSeverityClass(severity?: string | null) {
  return `pill pill--${(severity || "unknown").toLowerCase().replace(/\s+/g, "-")}`;
}

function getPayloadValue(data: unknown, key: string) {
  if (!data || typeof data !== "object") {
    return "";
  }

  const directValue = (data as Record<string, unknown>)[key];

  if (typeof directValue === "string") {
    return directValue;
  }

  const payload = (data as { payload?: Record<string, unknown> }).payload;
  const payloadValue = payload?.[key];

  return typeof payloadValue === "string" ? payloadValue : "";
}

export default function Home() {
  const [dashboardData, setDashboardData] = useState<DashboardData>(emptyDashboard);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const activeFilterEntries = Object.entries(filters).filter(([, value]) => Boolean(value));

  const localCouncilOptions = useMemo(() => {
    if (!filters.regionalCouncil) {
      return dashboardData.filterOptions.localCouncils;
    }

    return dashboardData.filterOptions.localCouncilsByRegion[filters.regionalCouncil] ?? [];
  }, [dashboardData.filterOptions, filters.regionalCouncil]);

  const incidentStatusChartData = useMemo(
    () => buildIncidentStatusPieData(dashboardData.incidentStatusTotals ?? []),
    [dashboardData.incidentStatusTotals]
  );

  const incidentStatusTotalCount = useMemo(
    () => incidentStatusChartData.reduce((sum, point) => sum + point.value, 0),
    [incidentStatusChartData]
  );

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    try {
      const response = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error(
          "[Dashboard API] Request failed:",
          response.status,
          response.statusText,
          detail ? detail.slice(0, 500) : ""
        );
        setDashboardData({
          ...emptyDashboard,
          message:
            "Dashboard data could not be loaded. The server returned an error. Check the terminal logs, database connection, and environment configuration."
        });
        return;
      }

      let data: DashboardData;

      try {
        data = (await response.json()) as DashboardData;
      } catch (parseError) {
        console.error("[Dashboard API] Response was not valid JSON:", parseError);
        setDashboardData({
          ...emptyDashboard,
          message: "Dashboard data could not be loaded. The API returned an unexpected response."
        });
        return;
      }

      setDashboardData(data);
    } catch (error) {
      console.error("[Dashboard API] Network error or request aborted:", error);
      setDashboardData({
        ...emptyDashboard,
        message: "Dashboard data could not be loaded. Check your network connection and that the app is running (npm run dev on http://127.0.0.1:3000)."
      });
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "regionalCouncil" ? { localCouncil: "" } : {})
    }));
  };

  const applyChartFilter = (key: keyof Filters, value: string) => {
    if (!value || value === "Unspecified" || value === "Unassigned") {
      return;
    }

    updateFilter(key, value);
  };

  const kpiCards = [
    { label: "Total Incidents Reported", value: dashboardData.kpis.totalIncidents, icon: "report" },
    { label: "Incidents Reported Today", value: dashboardData.kpis.todayIncidents, icon: "calendar" },
    { label: "Monthly Incident Count", value: dashboardData.kpis.monthlyIncidentCount, icon: "monthly" },
    { label: "Critical Incidents", value: dashboardData.kpis.criticalIncidents, icon: "critical" },
    { label: "High Severity Incidents", value: dashboardData.kpis.highSeverityIncidents, icon: "warning" },
    { label: "Active Incidents / Open Cases", value: dashboardData.kpis.activeIncidents, icon: "active" }
  ];

  return (
    <div className="app-shell">
      <SiteHeader />

      <div className={`workspace ${isSidebarExpanded ? "workspace--expanded" : "workspace--collapsed"}`}>
        <aside className="sidebar" aria-label="Dashboard navigation">
          <div className="sidebar__top">
            <button
              className="sidebar__toggle"
              type="button"
              aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={isSidebarExpanded}
              onClick={() => setIsSidebarExpanded((current) => !current)}
            >
              <SidebarIcon name="menu" />
            </button>
          </div>

          <nav className="sidebar__nav">
            <span className="sidebar__section">Menu</span>
            {sidebarItems.map((item) =>
              "href" in item ? (
                <Link className="sidebar__item" href={item.href} key={item.label} title={item.label}>
                  <SidebarIcon name={item.icon} />
                  <span className="sidebar__item-text">{item.label}</span>
                </Link>
              ) : (
                <button
                  className={`sidebar__item ${item.active ? "sidebar__item--active" : ""}`}
                  type="button"
                  key={item.label}
                  aria-current={item.active ? "page" : undefined}
                  title={item.label}
                >
                  <SidebarIcon name={item.icon} />
                  <span className="sidebar__item-text">{item.label}</span>
                </button>
              )
            )}
          </nav>
        </aside>

        <main className="dashboard management-dashboard">
          <section className="hero management-hero" aria-labelledby="dashboard-title">
            <div>
              <p className="brand__eyebrow">Top Management Dashboard</p>
              <h2 id="dashboard-title">Incident Reporting Dashboard (Safety and Security)</h2>
              <p>
                This dashboard provides a comprehensive overview of incident reporting across all regions. It helps
                management monitor safety, security, and health-related incidents, identify high-risk areas, and track
                response performance.
              </p>
            </div>
            <div className={`status-chip status-chip--${dashboardData.monthComparison.status.toLowerCase()}`}>
              {dashboardData.monthComparison.status}
            </div>
          </section>

          {dashboardData.kpis.criticalIncidents > 0 ? (
            <div className="alert-banner">
              Critical incident alert: {dashboardData.kpis.criticalIncidents} critical incident(s) require management attention.
            </div>
          ) : null}

          {!dashboardData.success && dashboardData.message && !isLoading ? (
            <div className="alert-banner alert-banner--muted">{dashboardData.message}</div>
          ) : null}

          {hasActiveFilters ? (
            <section className="active-filters" aria-label="Active dashboard filters">
              <span>Active filters</span>
              {activeFilterEntries.map(([key, value]) => (
                <button key={key} type="button" onClick={() => updateFilter(key as keyof Filters, "")}>
                  {key.replace(/([A-Z])/g, " $1")}: {value}
                </button>
              ))}
              <button className="active-filters__clear" type="button" onClick={() => setFilters(defaultFilters)}>
                Clear Filter
              </button>
            </section>
          ) : null}

          <section className="filter-panel panel">
            <div className="panel__header">
              <h3>Management Filters</h3>
              <p>All KPIs, charts, insights, and tables update based on the selected filters.</p>
            </div>
            <div className="filter-grid">
              <div className="field">
                <label htmlFor="dateFrom">Date From</label>
                <input id="dateFrom" type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="dateTo">Date To</label>
                <input id="dateTo" type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="regionalCouncilFilter">Regional Council</label>
                <select id="regionalCouncilFilter" value={filters.regionalCouncil} onChange={(event) => updateFilter("regionalCouncil", event.target.value)}>
                  <option value="">All regions</option>
                  {dashboardData.filterOptions.regionalCouncils.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="localCouncilFilter">Local Council</label>
                <select id="localCouncilFilter" value={filters.localCouncil} onChange={(event) => updateFilter("localCouncil", event.target.value)}>
                  <option value="">All local councils</option>
                  {localCouncilOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="categoryFilter">Incident Category</label>
                <select id="categoryFilter" value={filters.incidentCategory} onChange={(event) => updateFilter("incidentCategory", event.target.value)}>
                  <option value="">All categories</option>
                  {dashboardData.filterOptions.categories.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="severityFilter">Severity</label>
                <select id="severityFilter" value={filters.incidentSeverity} onChange={(event) => updateFilter("incidentSeverity", event.target.value)}>
                  <option value="">All severities</option>
                  {dashboardData.filterOptions.severities.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="teamFilter">Responsible Team</label>
                <select id="teamFilter" value={filters.responsibleTeam} onChange={(event) => updateFilter("responsibleTeam", event.target.value)}>
                  <option value="">All teams</option>
                  {dashboardData.filterOptions.responsibleTeams.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="incidentTypeFilter">Incident Type</label>
                <select id="incidentTypeFilter" value={filters.incidentType} onChange={(event) => updateFilter("incidentType", event.target.value)}>
                  <option value="">All incident types</option>
                  {dashboardData.filterOptions.incidentTypes.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="field filter-action">
                <button className="primary-button" type="button" onClick={() => setFilters(defaultFilters)}>
                  Reset Filters
                </button>
              </div>
            </div>
          </section>

          <section className="summary-grid management-kpis" aria-label="Executive KPI cards">
            {kpiCards.map((card) => (
              <article className="summary-card kpi-card" key={card.label}>
                <div className="kpi-card__top">
                  <span>{card.label}</span>
                  <KpiIcon name={card.icon as KpiIconName} />
                </div>
                <strong>{card.value}</strong>
              </article>
            ))}
          </section>

          {isLoading ? <div className="loading-state">Loading management dashboard...</div> : null}

          <section className="chart-grid">
            <ChartPanel title="Incident Category Analysis" description="Incident count by category">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={dashboardData.categoryTotals}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    onClick={(data) => applyChartFilter("incidentCategory", getPayloadValue(data, "name"))}
                  >
                    {dashboardData.categoryTotals.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Severity Analysis" description="Incident count by severity">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dashboardData.severityTotals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    radius={[8, 8, 0, 0]}
                    onClick={(data) => applyChartFilter("incidentSeverity", getPayloadValue(data, "name"))}
                  >
                    {dashboardData.severityTotals.map((entry) => (
                      <Cell key={entry.name} fill={severityColors[entry.name] ?? "#006b2f"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Regional Council Performance" description="Total incidents by regional council">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dashboardData.regionalTotals} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    fill="#149253"
                    radius={[0, 8, 8, 0]}
                    onClick={(data) => applyChartFilter("regionalCouncil", getPayloadValue(data, "name"))}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Monthly Trend Analysis" description="Month-wise incidents based on created date">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={dashboardData.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="incidents" stroke="#006b2f" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Responsible Team Workload" description="Incidents by responsible team and severity">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dashboardData.teamWorkload}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="team" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Low" stackId="severity" fill={severityColors.Low} onClick={(data) => applyChartFilter("responsibleTeam", getPayloadValue(data, "team"))} />
                  <Bar dataKey="Medium" stackId="severity" fill={severityColors.Medium} onClick={(data) => applyChartFilter("responsibleTeam", getPayloadValue(data, "team"))} />
                  <Bar dataKey="High" stackId="severity" fill={severityColors.High} onClick={(data) => applyChartFilter("responsibleTeam", getPayloadValue(data, "team"))} />
                  <Bar dataKey="Critical" stackId="severity" fill={severityColors.Critical} onClick={(data) => applyChartFilter("responsibleTeam", getPayloadValue(data, "team"))} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Incident Type Analysis" description="Top incident types">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dashboardData.incidentTypeTotals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#149253" radius={[8, 8, 0, 0]} onClick={(data) => applyChartFilter("incidentType", getPayloadValue(data, "name"))} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Local Council Drilldown" description={filters.regionalCouncil ? `Local councils in ${filters.regionalCouncil}` : "Top 10 local councils"}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dashboardData.localCouncilTotals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#006b2f" radius={[8, 8, 0, 0]} onClick={(data) => applyChartFilter("localCouncil", getPayloadValue(data, "name"))} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Incident Status Summary" description="Incident count by status (Open, In Progress, Closed)">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={incidentStatusChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {incidentStatusChartData.map((entry) => (
                      <Cell key={entry.name} fill={incidentStatusColors[entry.name] ?? "#149253"} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) {
                        return null;
                      }

                      const item = payload[0];
                      const value = Number(item.value ?? 0);
                      const total = incidentStatusTotalCount;
                      const pct = total ? ((value / total) * 100).toFixed(1) : "0.0";
                      const name = getPayloadValue(item, "name") || String(item.name ?? "");

                      return (
                        <div
                          style={{
                            background: "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            padding: "10px 12px",
                            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)"
                          }}
                        >
                          <p style={{ margin: 0, fontWeight: 600, color: "#0f172a" }}>{name || "Status"}</p>
                          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#334155" }}>
                            Count: <strong>{value}</strong>
                          </p>
                          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#334155" }}>
                            Total: <strong>{total}</strong>
                          </p>
                          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#334155" }}>
                            Share: <strong>{pct}%</strong>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>
          </section>

          <section className="insights-grid">
            <article className="panel insights-panel">
              <div className="panel__header">
                <h3>Key Insights</h3>
                <p>Dynamic management observations based on the selected filters.</p>
              </div>
              <ul>
                {dashboardData.insights.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            </article>
          </section>

          <section className="table-grid">
            <IncidentTable title="Critical & High Priority Incidents" rows={dashboardData.criticalHighIncidents} showVolunteer={false} />
            <IncidentTable title="Recent Incident Activity" rows={dashboardData.recentIncidents} showVolunteer />
          </section>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}

function ChartPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <article className="panel chart-panel">
      <div className="panel__header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="chart-body">{children}</div>
    </article>
  );
}

function IncidentTable({ title, rows, showVolunteer }: { title: string; rows: IncidentRow[]; showVolunteer: boolean }) {
  return (
    <article className="panel">
      <div className="panel__header">
        <h3>{title}</h3>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="incidents-table">
            <thead>
              <tr>
                <th>ID</th>
                {showVolunteer ? <th>Volunteer</th> : null}
                <th>Category</th>
                <th>Regional Council</th>
                <th>Local Council</th>
                <th>Severity</th>
                {!showVolunteer ? <th>Responsible Team</th> : null}
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((incident) => (
                <tr key={`${title}-${incident.IncidentID}`}>
                  <td>#{incident.IncidentID}</td>
                  {showVolunteer ? <td>{incident.VolunteerName || "N/A"}</td> : null}
                  <td>{incident.IncidentCategory || "N/A"}</td>
                  <td>{incident.RegionalCouncil || "N/A"}</td>
                  <td>{incident.LocalCouncil || "N/A"}</td>
                  <td><span className={getSeverityClass(incident.IncidentSeverity)}>{incident.IncidentSeverity || "N/A"}</span></td>
                  {!showVolunteer ? <td>{incident.ResponsibleTeam || "N/A"}</td> : null}
                  <td>{formatDate(incident.CreatedDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">No records found for the selected filters.</div>
      )}
    </article>
  );
}
