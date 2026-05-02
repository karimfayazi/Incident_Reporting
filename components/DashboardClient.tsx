"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type KPIs = {
  totalIncidents: number;
  todayIncidents: number;
  openIncidents: number;
  closedIncidents: number;
  highIncidents: number;
  criticalIncidents: number;
};

type ChartItem = { name: string; value: number };
type TrendItem = { month: string; incidents: number };
type RegionCouncilRow = { Region: string; LocalCouncil: string; TotalIncidents: number };

type IncidentRow = {
  IncidentID: number;
  Darbar_Location: string;
  Region: string;
  LocalCouncil: string;
  VolunteerName: string;
  VolunteerPhone: string;
  IncidentCategory: string;
  IncidentTitle: string;
  VillageLocation: string;
  IncidentDescription: string;
  IncidentPlace: string;
  ResponsibleTeam: string;
  IncidentSeverity: string;
  Incident_Status: string;
  CreatedDate: string;
  UpdatedDate: string | null;
  Image1: string | null;
  Image2: string | null;
  Image3: string | null;
};

type FilterOptions = {
  darbarLocations: string[];
  regions: string[];
  localCouncils: string[];
  categories: string[];
  severities: string[];
  statuses: string[];
  regionsByDarbar: Record<string, string[]>;
  councilsByRegion: Record<string, string[]>;
};

type TableMeta = {
  rows: IncidentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type DashboardData = {
  success: boolean;
  kpis: KPIs;
  severityTotals: ChartItem[];
  statusTotals: ChartItem[];
  regionTotals: ChartItem[];
  darbarTotals: ChartItem[];
  localCouncilTotals: ChartItem[];
  regionCouncilSummary: RegionCouncilRow[];
  monthlyTrend: TrendItem[];
  table: TableMeta;
  filterOptions: FilterOptions;
};

type Filters = {
  darbarLocation: string;
  region: string;
  localCouncil: string;
  incidentCategory: string;
  incidentSeverity: string;
  incidentStatus: string;
  dateFrom: string;
  dateTo: string;
};

type SortConfig = {
  column: string;
  order: "asc" | "desc";
};

type PreviewState = {
  src: string;
  title: string;
  loadError: boolean;
} | null;

const EMPTY_FILTERS: Filters = {
  darbarLocation: "",
  region: "",
  localCouncil: "",
  incidentCategory: "",
  incidentSeverity: "",
  incidentStatus: "",
  dateFrom: "",
  dateTo: ""
};

/* ------------------------------------------------------------------ */
/*  Chart colors                                                       */
/* ------------------------------------------------------------------ */

const SEVERITY_COLORS: Record<string, string> = {
  Low: "#6bb896",
  Medium: "#e8a838",
  High: "#e06449",
  Critical: "#c0392b",
  Unspecified: "#94a3b8"
};

const STATUS_COLORS: Record<string, string> = {
  Open: "#e8a838",
  "In Progress": "#3b82f6",
  Closed: "#22c55e",
  Resolved: "#6bb896"
};

const REGION_COLORS = ["#006b2f", "#0c8346", "#2aa364", "#4db882", "#76cfa0", "#9fdebb", "#c3edd4", "#e0f7ea"];

const DARBAR_COLORS = ["#1e3a5f", "#2b5c8a", "#3e7cb1", "#5a9bd5", "#7bb3e0", "#9dcbe8", "#bdddf0", "#d9eef7"];

const LC_COLORS = ["#4c1d95", "#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe"];

const PIE_FALLBACK = ["#e8a838", "#3b82f6", "#22c55e", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1] || m} ${y}`;
}

function severityPillClass(severity: string) {
  const s = severity?.toLowerCase();
  if (s === "critical") return "pill pill--critical";
  if (s === "high") return "pill pill--high";
  if (s === "medium") return "pill pill--medium";
  if (s === "low") return "pill pill--low";
  return "pill";
}

function statusPillClass(status: string) {
  const s = status?.toLowerCase();
  if (s === "open") return "pill dash-pill--open";
  if (s === "in progress") return "pill dash-pill--progress";
  if (s === "closed") return "pill dash-pill--closed";
  return "pill";
}

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

function IconClipboard() {
  return (
    <svg className="kpi-icon" viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="kpi-icon" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconFolderOpen() {
  return (
    <svg className="kpi-icon" viewBox="0 0 24 24">
      <path d="M5 19V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1" />
      <path d="M20 13H4l2 6h12l2-6z" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg className="kpi-icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg className="kpi-icon" viewBox="0 0 24 24">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
    </svg>
  );
}

function IconShieldAlert() {
  return (
    <svg className="kpi-icon" viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconChevronSort({ dir }: { dir: "asc" | "desc" | null }) {
  if (dir === "asc") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  }
  if (dir === "desc") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.35">
      <polyline points="7 10 12 5 17 10" />
      <polyline points="7 14 12 19 17 14" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart tooltip & label                                              */
/* ------------------------------------------------------------------ */

function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      {label && <p className="dash-tooltip__label">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="dash-tooltip__value" style={{ color: entry.color }}>
          {entry.name ? `${entry.name}: ` : ""}<strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

function BarLabel({ x, y, width, value }: { x?: number; y?: number; width?: number; value?: number }) {
  if (!value || !x || !y || !width) return null;
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="var(--ink)" fontSize={11} fontWeight={700}>
      {value}
    </text>
  );
}

/* ------------------------------------------------------------------ */
/*  Image Modal                                                        */
/* ------------------------------------------------------------------ */

function ImageModal({ preview, onClose }: { preview: PreviewState; onClose: () => void }) {
  useEffect(() => {
    if (!preview) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [preview, onClose]);

  if (!preview) return null;

  return (
    <div className="export-image-modal-overlay" role="presentation" onClick={onClose}>
      <div className="export-image-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="export-image-modal__header">
          <h3>{preview.title}</h3>
          <button type="button" className="export-image-modal__close" onClick={onClose}>Close</button>
        </div>
        <div className="export-image-modal__body">
          {preview.loadError ? (
            <p className="export-image-modal__error">This image could not be loaded.</p>
          ) : (
            <img src={preview.src} alt={preview.title} className="export-image-modal__img" onError={() => {}} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Image Thumbnail                                                    */
/* ------------------------------------------------------------------ */

function ImageThumb({ src, label, onOpen }: { src: string | null; label: string; onOpen: (src: string, title: string) => void }) {
  const [failed, setFailed] = useState(false);

  if (!src?.trim()) {
    return <span className="dash-img-empty">—</span>;
  }

  return failed ? (
    <span className="export-image-cell__thumb-fallback">IMG</span>
  ) : (
    <button type="button" className="export-image-cell__preview" onClick={() => onOpen(src, label)} aria-label={`View ${label}`}>
      <img src={src} alt="" className="export-image-cell__thumb" onError={() => setFailed(true)} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortConfig>({ column: "CreatedDate", order: "desc" });

  const [preview, setPreview] = useState<PreviewState>(null);

  const initialLoadDone = useRef(false);

  const buildQuery = useCallback(
    (f: Filters, p: number, s: SortConfig, srch: string) => {
      const params = new URLSearchParams();
      if (f.darbarLocation) params.set("darbarLocation", f.darbarLocation);
      if (f.region) params.set("region", f.region);
      if (f.localCouncil) params.set("localCouncil", f.localCouncil);
      if (f.incidentCategory) params.set("incidentCategory", f.incidentCategory);
      if (f.incidentSeverity) params.set("incidentSeverity", f.incidentSeverity);
      if (f.incidentStatus) params.set("incidentStatus", f.incidentStatus);
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      params.set("page", String(p));
      params.set("pageSize", "20");
      params.set("sortBy", s.column);
      params.set("sortOrder", s.order);
      if (srch) params.set("search", srch);
      return `/api/dashboard?${params.toString()}`;
    },
    []
  );

  /* ---- FIXED: always read JSON body, never throw on non-200 ---- */
  const fetchData = useCallback(
    async (f: Filters, p: number, s: SortConfig, srch: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(buildQuery(f, p, s, srch), { cache: "no-store" });
        const json = (await res.json()) as DashboardData;
        setData(json);

        if (!json.success && json.kpis.totalIncidents === 0) {
          setError("No dashboard data available for selected filters.");
        } else {
          setError("");
        }
      } catch {
        setError("Unable to connect to the server. Please check your network and try again.");
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchData(EMPTY_FILTERS, 1, sort, "");
    }
  }, [fetchData, sort]);

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
    setAppliedSearch(search);
    fetchData(filters, 1, sort, search);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSearch("");
    setAppliedSearch("");
    setPage(1);
    setSort({ column: "CreatedDate", order: "desc" });
    fetchData(EMPTY_FILTERS, 1, { column: "CreatedDate", order: "desc" }, "");
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchData(appliedFilters, newPage, sort, appliedSearch);
  };

  const handleSort = (column: string) => {
    const newSort: SortConfig =
      sort.column === column
        ? { column, order: sort.order === "asc" ? "desc" : "asc" }
        : { column, order: "asc" };
    setSort(newSort);
    setPage(1);
    fetchData(appliedFilters, 1, newSort, appliedSearch);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search);
    setPage(1);
    fetchData(appliedFilters, 1, sort, search);
  };

  const handleChartFilter = (key: keyof Filters, value: string) => {
    const next = { ...appliedFilters, [key]: value };
    setFilters(next);
    setAppliedFilters(next);
    setPage(1);
    fetchData(next, 1, sort, appliedSearch);
  };

  const openPreview = useCallback((src: string, title: string) => {
    setPreview({ src, title, loadError: false });
  }, []);

  const closePreview = useCallback(() => setPreview(null), []);

  /* ---- Dependent filter options ---- */
  const regionOptions = useMemo(() => {
    if (!data) return [];
    if (filters.darbarLocation && data.filterOptions.regionsByDarbar[filters.darbarLocation]) {
      return data.filterOptions.regionsByDarbar[filters.darbarLocation];
    }
    return data.filterOptions.regions;
  }, [data, filters.darbarLocation]);

  const councilOptions = useMemo(() => {
    if (!data) return [];
    if (filters.region && data.filterOptions.councilsByRegion[filters.region]) {
      return data.filterOptions.councilsByRegion[filters.region];
    }
    return data.filterOptions.localCouncils;
  }, [data, filters.region]);

  /* ---- Export helpers ---- */
  const exportToExcel = () => {
    if (!data?.table.rows.length) return;
    import("xlsx").then((XLSX) => {
      const ws = XLSX.utils.json_to_sheet(
        data.table.rows.map((r) => ({
          "Incident ID": r.IncidentID,
          "Darbar Location": r.Darbar_Location,
          Region: r.Region,
          "Local Council": r.LocalCouncil,
          Volunteer: r.VolunteerName,
          Category: r.IncidentCategory,
          Title: r.IncidentTitle,
          Severity: r.IncidentSeverity,
          Status: r.Incident_Status,
          "Created Date": formatDate(r.CreatedDate)
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Incidents");
      XLSX.writeFile(wb, `incidents-${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  };

  const exportToPdf = () => {
    if (!data?.table.rows.length) return;
    Promise.all([import("jspdf"), import("jspdf-autotable")]).then(([{ jsPDF }]) => {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("Incident Reporting Dashboard", 14, 16);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

      const head = [["ID", "Darbar", "Region", "Council", "Title", "Severity", "Status", "Created"]];
      const body = data.table.rows.map((r) => [
        String(r.IncidentID),
        r.Darbar_Location,
        r.Region,
        r.LocalCouncil,
        r.IncidentTitle?.slice(0, 40) || "—",
        r.IncidentSeverity,
        r.Incident_Status,
        formatDate(r.CreatedDate)
      ]);

      (doc as unknown as { autoTable: (opts: object) => void }).autoTable({
        startY: 28,
        head,
        body,
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [0, 107, 47], textColor: 255 }
      });

      doc.save(`incidents-${new Date().toISOString().slice(0, 10)}.pdf`);
    });
  };

  /* ---- Derived data ---- */
  const kpis = data?.kpis ?? { totalIncidents: 0, todayIncidents: 0, openIncidents: 0, closedIncidents: 0, highIncidents: 0, criticalIncidents: 0 };
  const hasData = data && data.kpis.totalIncidents > 0;

  const kpiCards = [
    { label: "Total Incidents", value: kpis.totalIncidents, icon: <IconClipboard />, accent: "var(--green)" },
    { label: "Incidents Today", value: kpis.todayIncidents, icon: <IconCalendar />, accent: "#3b82f6" },
    { label: "Open Incidents", value: kpis.openIncidents, icon: <IconFolderOpen />, accent: "#e8a838" },
    { label: "Closed Incidents", value: kpis.closedIncidents, icon: <IconCheckCircle />, accent: "#22c55e" },
    { label: "High Severity", value: kpis.highIncidents, icon: <IconAlertTriangle />, accent: "#e06449" },
    { label: "Critical Severity", value: kpis.criticalIncidents, icon: <IconShieldAlert />, accent: "#c0392b" }
  ];

  const tableCols = [
    { key: "IncidentID", label: "ID", width: "70px" },
    { key: "Darbar_Location", label: "Darbar Location", width: "140px" },
    { key: "Region", label: "Region", width: "140px" },
    { key: "LocalCouncil", label: "Local Council", width: "140px" },
    { key: "IncidentTitle", label: "Incident Title", width: "200px" },
    { key: "IncidentSeverity", label: "Severity", width: "100px" },
    { key: "Incident_Status", label: "Status", width: "100px" },
    { key: "CreatedDate", label: "Created Date", width: "110px" }
  ];

  const tableRows = data?.table.rows ?? [];
  const tableMeta = data?.table ?? { total: 0, page: 1, pageSize: 20, totalPages: 0, rows: [] };

  /* ---- Chart helper: dynamic height for horizontal bars ---- */
  const lcChartHeight = Math.max(330, (data?.localCouncilTotals.length ?? 0) * 32 + 60);

  /* ---- Render ---- */
  return (
    <div className="dash">
      {/* ============ KPI CARDS ============ */}
      <section className="dash-kpis" aria-label="Key performance indicators">
        {kpiCards.map((card) => (
          <article key={card.label} className="summary-card dash-kpi-card" style={{ borderTopColor: card.accent }}>
            <div className="kpi-card">
              <div className="kpi-card__top">
                <span>{card.label}</span>
                <div style={{ color: card.accent }}>{card.icon}</div>
              </div>
              <strong style={{ color: card.accent }}>
                {loading ? "—" : card.value.toLocaleString()}
              </strong>
            </div>
          </article>
        ))}
      </section>

      {/* ============ FILTER PANEL ============ */}
      <section className="panel dash-filter-panel" aria-label="Filters">
        <div className="panel__header dash-filter-header">
          <div className="dash-filter-header__title">
            <IconFilter />
            <h3>Filters</h3>
          </div>
        </div>
        <div className="dash-filter-grid">
          <div className="field">
            <label>Darbar Location</label>
            <select value={filters.darbarLocation} onChange={(e) => setFilters((f) => ({ ...f, darbarLocation: e.target.value, region: "", localCouncil: "" }))}>
              <option value="">All</option>
              {data?.filterOptions.darbarLocations.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Region</label>
            <select value={filters.region} onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value, localCouncil: "" }))}>
              <option value="">All</option>
              {regionOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Local Council</label>
            <select value={filters.localCouncil} onChange={(e) => setFilters((f) => ({ ...f, localCouncil: e.target.value }))}>
              <option value="">All</option>
              {councilOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Incident Category</label>
            <select value={filters.incidentCategory} onChange={(e) => setFilters((f) => ({ ...f, incidentCategory: e.target.value }))}>
              <option value="">All</option>
              {data?.filterOptions.categories.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Incident Severity</label>
            <select value={filters.incidentSeverity} onChange={(e) => setFilters((f) => ({ ...f, incidentSeverity: e.target.value }))}>
              <option value="">All</option>
              {data?.filterOptions.severities.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Incident Status</label>
            <select value={filters.incidentStatus} onChange={(e) => setFilters((f) => ({ ...f, incidentStatus: e.target.value }))}>
              <option value="">All</option>
              {data?.filterOptions.statuses.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Date From</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div className="field">
            <label>Date To</label>
            <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
          </div>
        </div>
        <div className="dash-filter-actions">
          <button type="button" className="primary-button" onClick={handleApplyFilters} disabled={loading}>
            Apply Filters
          </button>
          <button type="button" className="secondary-button" onClick={handleResetFilters} disabled={loading}>
            Reset Filters
          </button>
        </div>
      </section>

      {/* ============ EMPTY STATE (not error) ============ */}
      {!loading && !hasData && (
        <div className="dash-empty-banner">No dashboard data available for selected filters.</div>
      )}

      {/* ============ NETWORK ERROR ============ */}
      {!loading && error && error.startsWith("Unable") && (
        <div className="dash-empty-banner dash-empty-banner--error">{error}</div>
      )}

      {/* ============ CHARTS — ROW 1: Severity + Status ============ */}
      {(loading || hasData) && (
        <section className="dash-charts" aria-label="Charts">
          <article className="panel chart-panel">
            <div className="panel__header"><h3>Incidents by Severity</h3></div>
            <div className="chart-body">
              {loading ? <div className="dash-chart-skeleton" /> : (data?.severityTotals.length ?? 0) === 0 ? (
                <div className="empty-state">No severity data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.severityTotals} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" name="Incidents" radius={[6, 6, 0, 0]} label={<BarLabel />} cursor="pointer" onClick={(entry: { name?: string }) => entry.name && handleChartFilter("incidentSeverity", entry.name)}>
                      {data!.severityTotals.map((entry) => (
                        <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          <article className="panel chart-panel">
            <div className="panel__header"><h3>Incidents by Status</h3></div>
            <div className="chart-body">
              {loading ? <div className="dash-chart-skeleton" /> : (data?.statusTotals.length ?? 0) === 0 ? (
                <div className="empty-state">No status data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data!.statusTotals}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                      cursor="pointer"
                      onClick={(entry: { name?: string }) => entry.name && handleChartFilter("incidentStatus", entry.name)}
                    >
                      {data!.statusTotals.map((entry, i) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? PIE_FALLBACK[i % PIE_FALLBACK.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          {/* ============ ROW 2: Darbar Location + Region ============ */}
          <article className="panel chart-panel">
            <div className="panel__header"><h3>Incidents by Darbar Location</h3></div>
            <div className="chart-body">
              {loading ? <div className="dash-chart-skeleton" /> : (data?.darbarTotals.length ?? 0) === 0 ? (
                <div className="empty-state">No Darbar location data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.darbarTotals} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted)" }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" name="Incidents" radius={[6, 6, 0, 0]} label={<BarLabel />} cursor="pointer" onClick={(entry: { name?: string }) => entry.name && handleChartFilter("darbarLocation", entry.name)}>
                      {data!.darbarTotals.map((_, i) => (
                        <Cell key={i} fill={DARBAR_COLORS[i % DARBAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          <article className="panel chart-panel">
            <div className="panel__header"><h3>Incidents by Region</h3></div>
            <div className="chart-body">
              {loading ? <div className="dash-chart-skeleton" /> : (data?.regionTotals.length ?? 0) === 0 ? (
                <div className="empty-state">No region data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.regionTotals} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" name="Incidents" radius={[0, 6, 6, 0]} cursor="pointer" onClick={(entry: { name?: string }) => entry.name && handleChartFilter("region", entry.name)}>
                      {data!.regionTotals.map((_, i) => (
                        <Cell key={i} fill={REGION_COLORS[i % REGION_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          {/* ============ ROW 3: Local Council + Monthly Trend ============ */}
          <article className="panel chart-panel">
            <div className="panel__header"><h3>Incidents by Local Council</h3></div>
            <div className="chart-body" style={{ height: lcChartHeight }}>
              {loading ? <div className="dash-chart-skeleton" /> : (data?.localCouncilTotals.length ?? 0) === 0 ? (
                <div className="empty-state">No Local Council data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.localCouncilTotals} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 9, fill: "var(--muted)" }} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" name="Incidents" radius={[0, 6, 6, 0]} cursor="pointer" onClick={(entry: { name?: string }) => entry.name && handleChartFilter("localCouncil", entry.name)}>
                      {data!.localCouncilTotals.map((_, i) => (
                        <Cell key={i} fill={LC_COLORS[i % LC_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          <article className="panel chart-panel">
            <div className="panel__header"><h3>Monthly Trend</h3></div>
            <div className="chart-body">
              {loading ? <div className="dash-chart-skeleton" /> : (data?.monthlyTrend.length ?? 0) === 0 ? (
                <div className="empty-state">No trend data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data!.monthlyTrend.map((t) => ({ ...t, label: formatMonthLabel(t.month) }))} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="incidents" name="Incidents" stroke="var(--green)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--green)" }} activeDot={{ r: 6 }} label={{ fontSize: 10, fill: "var(--ink)", position: "top" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>
        </section>
      )}

      {/* ============ REGION + LOCAL COUNCIL SUMMARY ============ */}
      {!loading && (data?.regionCouncilSummary.length ?? 0) > 0 && (
        <section className="panel dash-summary-panel" aria-label="Region and Local Council summary">
          <div className="panel__header">
            <h3>Region + Local Council Summary</h3>
            <p>{data!.regionCouncilSummary.length} group(s)</p>
          </div>
          <div className="table-wrap">
            <table className="incidents-table dash-summary-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Local Council</th>
                  <th style={{ textAlign: "right" }}>Total Incidents</th>
                </tr>
              </thead>
              <tbody>
                {data!.regionCouncilSummary.map((row, i) => (
                  <tr key={i}>
                    <td>{row.Region}</td>
                    <td>{row.LocalCouncil}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{row.TotalIncidents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ============ DATA TABLE ============ */}
      <section className="panel dash-table-panel" aria-label="Incident data table">
        <div className="panel__header">
          <div className="dash-table-toolbar">
            <div>
              <h3>Incident Records</h3>
              <p>{tableMeta.total.toLocaleString()} record(s) found</p>
            </div>
            <div className="dash-table-toolbar__actions">
              <form className="dash-search-form" onSubmit={handleSearchSubmit}>
                <div className="dash-search-input-wrap">
                  <IconSearch />
                  <input type="text" placeholder="Search incidents..." value={search} onChange={(e) => setSearch(e.target.value)} className="dash-search-input" />
                </div>
              </form>
              <button type="button" className="secondary-button dash-export-btn" onClick={exportToExcel} disabled={!tableRows.length}>
                <IconDownload /> Excel
              </button>
              <button type="button" className="secondary-button dash-export-btn" onClick={exportToPdf} disabled={!tableRows.length}>
                <IconDownload /> PDF
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading incident data...</div>
        ) : tableRows.length === 0 ? (
          <div className="dash-empty-banner" style={{ margin: 16 }}>No data available for selected filters</div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="incidents-table dash-table">
                <thead>
                  <tr>
                    {tableCols.map((col) => (
                      <th key={col.key} style={{ width: col.width, minWidth: col.width }}>
                        <button type="button" className="dash-sort-btn" onClick={() => handleSort(col.key)}>
                          {col.label}
                          <IconChevronSort dir={sort.column === col.key ? sort.order : null} />
                        </button>
                      </th>
                    ))}
                    <th style={{ width: "200px" }}>Images</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.IncidentID}>
                      <td>{row.IncidentID}</td>
                      <td>{row.Darbar_Location || "—"}</td>
                      <td>{row.Region || "—"}</td>
                      <td>{row.LocalCouncil || "—"}</td>
                      <td className="dash-cell-title">{row.IncidentTitle || "—"}</td>
                      <td><span className={severityPillClass(row.IncidentSeverity)}>{row.IncidentSeverity || "—"}</span></td>
                      <td><span className={statusPillClass(row.Incident_Status)}>{row.Incident_Status || "Open"}</span></td>
                      <td>{formatDate(row.CreatedDate)}</td>
                      <td>
                        <div className="dash-images-cell">
                          <ImageThumb src={row.Image1} label={`Incident ${row.IncidentID} - Image 1`} onOpen={openPreview} />
                          <ImageThumb src={row.Image2} label={`Incident ${row.IncidentID} - Image 2`} onOpen={openPreview} />
                          <ImageThumb src={row.Image3} label={`Incident ${row.IncidentID} - Image 3`} onOpen={openPreview} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {tableMeta.totalPages > 1 && (
              <div className="dash-pagination">
                <button type="button" className="secondary-button" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>
                  Previous
                </button>
                <div className="dash-pagination__info">
                  Page <strong>{tableMeta.page}</strong> of <strong>{tableMeta.totalPages}</strong>
                  <span className="dash-pagination__total">({tableMeta.total.toLocaleString()} records)</span>
                </div>
                <button type="button" className="secondary-button" disabled={page >= tableMeta.totalPages} onClick={() => handlePageChange(page + 1)}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <ImageModal preview={preview} onClose={closePreview} />
    </div>
  );
}
