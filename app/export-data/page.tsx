"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import type { SessionUser } from "@/lib/session";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ExportRow = {
  IncidentID: number;
  Darbar_Location: string;
  VolunteerName: string;
  VolunteerPhone: string;
  IncidentCategory: string;
  IncidentTitle: string;
  Region: string;
  LocalCouncil: string;
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

type ApiResponse = {
  success: boolean;
  message?: string;
  rows: ExportRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

type SortConfig = { column: string; order: "asc" | "desc" };

type PreviewState = { src: string; title: string; loadError: boolean } | null;

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
/*  Column definitions                                                 */
/* ------------------------------------------------------------------ */

const TABLE_COLUMNS = [
  { key: "IncidentID", label: "Incident ID", width: "90px" },
  { key: "Darbar_Location", label: "Darbar Location", width: "150px" },
  { key: "VolunteerName", label: "Volunteer Name", width: "140px" },
  { key: "VolunteerPhone", label: "Phone Number", width: "120px" },
  { key: "IncidentCategory", label: "Category", width: "100px" },
  { key: "IncidentTitle", label: "Title", width: "180px" },
  { key: "Region", label: "Region", width: "140px" },
  { key: "LocalCouncil", label: "Local Council", width: "140px" },
  { key: "VillageLocation", label: "Village", width: "130px" },
  { key: "IncidentDescription", label: "Description", width: "200px" },
  { key: "IncidentPlace", label: "Place", width: "130px" },
  { key: "ResponsibleTeam", label: "Responsible Team", width: "130px" },
  { key: "IncidentSeverity", label: "Severity", width: "90px" },
  { key: "Incident_Status", label: "Status", width: "90px" },
  { key: "CreatedDate", label: "Created Date", width: "120px" },
  { key: "UpdatedDate", label: "Updated Date", width: "120px" }
] as const;

const EXCEL_COLUMNS = TABLE_COLUMNS.map((c) => ({ key: c.key, header: c.label }));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function cellValue(row: ExportRow, key: string): string {
  const raw = (row as Record<string, unknown>)[key];
  if (raw === null || raw === undefined || raw === "") return "—";
  if (key === "CreatedDate" || key === "UpdatedDate") return formatDate(raw as string);
  if (key === "Incident_Status") {
    const s = String(raw).trim().toLowerCase();
    if (!s || s === "open") return "Open";
    if (s === "closed") return "Closed";
    if (s === "in progress" || s === "inprogress" || s === "in_progress") return "In Progress";
    return String(raw).trim();
  }
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  return String(raw);
}

function severityClass(sev: string) {
  const s = sev?.toLowerCase();
  if (s === "critical") return "pill pill--critical";
  if (s === "high") return "pill pill--high";
  if (s === "medium") return "pill pill--medium";
  if (s === "low") return "pill pill--low";
  return "pill";
}

function statusClass(status: string) {
  const s = status?.toLowerCase();
  if (s === "open") return "pill dash-pill--open";
  if (s === "in progress") return "pill dash-pill--progress";
  if (s === "closed") return "pill dash-pill--closed";
  return "pill";
}

/* ------------------------------------------------------------------ */
/*  Inline icons                                                       */
/* ------------------------------------------------------------------ */

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

function IconFilter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IconSort({ dir }: { dir: "asc" | "desc" | null }) {
  if (dir === "asc") return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>;
  if (dir === "desc") return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>;
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.35"><polyline points="7 10 12 5 17 10" /><polyline points="7 14 12 19 17 14" /></svg>;
}

/* ------------------------------------------------------------------ */
/*  Image components                                                   */
/* ------------------------------------------------------------------ */

function ImageThumb({ src, label, onOpen }: { src: string | null; label: string; onOpen: (s: string, t: string) => void }) {
  const [failed, setFailed] = useState(false);
  const path = src?.trim();
  if (!path) return <span className="export-cell--empty">No Image</span>;
  if (failed) return <span className="export-image-cell__thumb-fallback">IMG</span>;
  return (
    <button type="button" className="export-image-cell__preview" onClick={() => onOpen(path, label)} aria-label={`View ${label}`}>
      <img src={path} alt="" className="export-image-cell__thumb" onError={() => setFailed(true)} />
    </button>
  );
}

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
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */

export default function ExportDataPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  const [rows, setRows] = useState<ExportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortConfig>({ column: "CreatedDate", order: "desc" });

  const [preview, setPreview] = useState<PreviewState>(null);
  const initialLoadDone = useRef(false);

  /* ---- Auth ---- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { user?: SessionUser | null };
        if (!res.ok || data.user?.role !== "admin") {
          router.replace(res.status === 401 ? "/" : "/dashboard");
          return;
        }
        setUser(data.user);
      } finally {
        setIsUserLoading(false);
      }
    })();
  }, [router]);

  /* ---- Data fetching ---- */
  const buildUrl = useCallback((f: Filters, p: number, s: SortConfig, srch: string) => {
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
    params.set("pageSize", "25");
    params.set("sortBy", s.column);
    params.set("sortOrder", s.order);
    if (srch) params.set("search", srch);
    return `/api/export-data?${params.toString()}`;
  }, []);

  const fetchData = useCallback(async (f: Filters, p: number, s: SortConfig, srch: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(buildUrl(f, p, s, srch), { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 0);
      if (json.filterOptions) setFilterOptions(json.filterOptions);
      if (!json.success) setError(json.message || "No records found.");
    } catch {
      setError("Unable to connect to the server. Please check your network.");
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchData(EMPTY_FILTERS, 1, sort, "");
    }
  }, [fetchData, sort]);

  /* ---- Handlers ---- */
  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setAppliedSearch(search);
    setPage(1);
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

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchData(appliedFilters, p, sort, appliedSearch);
  };

  const handleSort = (column: string) => {
    const next: SortConfig = sort.column === column
      ? { column, order: sort.order === "asc" ? "desc" : "asc" }
      : { column, order: "asc" };
    setSort(next);
    setPage(1);
    fetchData(appliedFilters, 1, next, appliedSearch);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search);
    setPage(1);
    fetchData(appliedFilters, 1, sort, search);
  };

  const openPreview = useCallback((src: string, title: string) => setPreview({ src, title, loadError: false }), []);
  const closePreview = useCallback(() => setPreview(null), []);

  /* ---- Dependent filter options ---- */
  const regionOptions = useMemo(() => {
    if (!filterOptions) return [];
    if (filters.darbarLocation && filterOptions.regionsByDarbar[filters.darbarLocation]) {
      return filterOptions.regionsByDarbar[filters.darbarLocation];
    }
    return filterOptions.regions;
  }, [filterOptions, filters.darbarLocation]);

  const councilOptions = useMemo(() => {
    if (!filterOptions) return [];
    if (filters.region && filterOptions.councilsByRegion[filters.region]) {
      return filterOptions.councilsByRegion[filters.region];
    }
    return filterOptions.localCouncils;
  }, [filterOptions, filters.region]);

  /* ---- Export: Excel ---- */
  const exportToExcel = () => {
    if (!rows.length) return;
    import("xlsx").then((XLSX) => {
      const ws = XLSX.utils.json_to_sheet(
        rows.map((r) => {
          const obj: Record<string, string> = {};
          for (const col of EXCEL_COLUMNS) obj[col.header] = cellValue(r, col.key);
          return obj;
        })
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Incident Data");
      XLSX.writeFile(wb, `incident-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  };

  /* ---- Export: PDF ---- */
  const exportToPdf = () => {
    if (!rows.length) return;
    Promise.all([import("jspdf"), import("jspdf-autotable")]).then(([{ jsPDF }, autoTableModule]) => {
      const autoTable = autoTableModule.default;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      doc.setFontSize(16);
      doc.text("Incident Reporting Data", 14, 16);
      doc.setFontSize(9);
      doc.text(`Exported: ${new Date().toLocaleString()}  |  Records: ${rows.length}`, 14, 23);

      const pdfCols = ["ID", "Darbar", "Volunteer", "Phone", "Category", "Title", "Region", "Council", "Village", "Team", "Severity", "Status", "Created"];
      const pdfBody = rows.map((r) => [
        String(r.IncidentID),
        r.Darbar_Location || "—",
        r.VolunteerName || "—",
        r.VolunteerPhone || "—",
        r.IncidentCategory || "—",
        (r.IncidentTitle || "—").slice(0, 35),
        r.Region || "—",
        r.LocalCouncil || "—",
        (r.VillageLocation || "—").slice(0, 25),
        r.ResponsibleTeam || "—",
        r.IncidentSeverity || "—",
        r.Incident_Status || "Open",
        formatDate(r.CreatedDate)
      ]);

      autoTable(doc, {
        startY: 28,
        head: [pdfCols],
        body: pdfBody,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [0, 107, 47], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [244, 248, 245] }
      });

      doc.save(`incident-export-${new Date().toISOString().slice(0, 10)}.pdf`);
    });
  };

  /* ---- Loading gate ---- */
  if (isUserLoading) return <div className="loading-state">Loading...</div>;
  if (!user) return null;

  return (
    <WorkspaceShell user={user} active="Export Data">
      <main className="export-page">
        <section className="hero record-page__hero" aria-labelledby="export-title">
          <div>
            <p className="brand__eyebrow">Incident Reporting</p>
            <h2 id="export-title">Export Data</h2>
            <p>Browse, search, filter, and export incident records.</p>
          </div>
        </section>

        {/* ============ FILTER PANEL ============ */}
        <section className="panel exp-filter-panel" aria-label="Filters">
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
                {filterOptions?.darbarLocations.map((v) => <option key={v} value={v}>{v}</option>)}
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
              <label>Category</label>
              <select value={filters.incidentCategory} onChange={(e) => setFilters((f) => ({ ...f, incidentCategory: e.target.value }))}>
                <option value="">All</option>
                {filterOptions?.categories.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Severity</label>
              <select value={filters.incidentSeverity} onChange={(e) => setFilters((f) => ({ ...f, incidentSeverity: e.target.value }))}>
                <option value="">All</option>
                {filterOptions?.severities.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={filters.incidentStatus} onChange={(e) => setFilters((f) => ({ ...f, incidentStatus: e.target.value }))}>
                <option value="">All</option>
                {filterOptions?.statuses.map((v) => <option key={v} value={v}>{v}</option>)}
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
            <button type="button" className="primary-button" onClick={handleApplyFilters} disabled={loading}>Apply Filters</button>
            <button type="button" className="secondary-button" onClick={handleResetFilters} disabled={loading}>Reset Filters</button>
          </div>
        </section>

        {/* ============ DATA TABLE ============ */}
        <article className="panel exp-table-panel">
          <div className="panel__header">
            <div className="dash-table-toolbar">
              <div>
                <h3>Incident Reporting Data</h3>
                <p>{total.toLocaleString()} record(s) found</p>
              </div>
              <div className="dash-table-toolbar__actions">
                <form className="dash-search-form" onSubmit={handleSearchSubmit}>
                  <div className="dash-search-input-wrap">
                    <IconSearch />
                    <input type="text" placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} className="dash-search-input" />
                  </div>
                </form>
                <button type="button" className="secondary-button dash-export-btn" onClick={exportToExcel} disabled={!rows.length}>
                  <IconDownload /> Excel
                </button>
                <button type="button" className="secondary-button dash-export-btn" onClick={exportToPdf} disabled={!rows.length}>
                  <IconDownload /> PDF
                </button>
              </div>
            </div>
          </div>

          {error && !loading && <div className="dash-empty-banner" style={{ margin: 16 }}>{error}</div>}
          {loading && <div className="loading-state">Loading data...</div>}

          {!loading && rows.length > 0 && (
            <>
              <div className="table-wrap export-table-wrap">
                <table className="incidents-table export-table exp-grid">
                  <thead>
                    <tr>
                      {TABLE_COLUMNS.map((col) => (
                        <th key={col.key} style={{ width: col.width, minWidth: col.width }}>
                          <button type="button" className="dash-sort-btn" onClick={() => handleSort(col.key)}>
                            {col.label}
                            <IconSort dir={sort.column === col.key ? sort.order : null} />
                          </button>
                        </th>
                      ))}
                      <th className="export-table__th--image">Image 1</th>
                      <th className="export-table__th--image">Image 2</th>
                      <th className="export-table__th--image">Image 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.IncidentID}>
                        {TABLE_COLUMNS.map((col) => {
                          const val = cellValue(row, col.key);
                          if (col.key === "IncidentSeverity") return <td key={col.key}><span className={severityClass(val)}>{val}</span></td>;
                          if (col.key === "Incident_Status") return <td key={col.key}><span className={statusClass(val)}>{val}</span></td>;
                          if (col.key === "IncidentDescription") return <td key={col.key} className="exp-cell-desc" title={val}>{val}</td>;
                          return <td key={col.key}>{val}</td>;
                        })}
                        <td className="export-table__cell--image"><ImageThumb src={row.Image1} label={`Incident ${row.IncidentID} - Image 1`} onOpen={openPreview} /></td>
                        <td className="export-table__cell--image"><ImageThumb src={row.Image2} label={`Incident ${row.IncidentID} - Image 2`} onOpen={openPreview} /></td>
                        <td className="export-table__cell--image"><ImageThumb src={row.Image3} label={`Incident ${row.IncidentID} - Image 3`} onOpen={openPreview} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="dash-pagination">
                  <button type="button" className="secondary-button" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>Previous</button>
                  <div className="dash-pagination__info">
                    Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                    <span className="dash-pagination__total">({total.toLocaleString()} records)</span>
                  </div>
                  <button type="button" className="secondary-button" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>Next</button>
                </div>
              )}
            </>
          )}

          {!loading && rows.length === 0 && !error && (
            <div className="dash-empty-banner" style={{ margin: 16 }}>No records found.</div>
          )}
        </article>
      </main>

      <ImageModal preview={preview} onClose={closePreview} />
    </WorkspaceShell>
  );
}
