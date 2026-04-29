"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

type ExportRow = Record<string, string | number | boolean | null>;

/** Non-image columns shown in the grid and Excel (database column names). */
const textColumns = [
  "IncidentID",
  "VolunteerName",
  "VolunteerPhone",
  "IncidentCategory",
  "ConcernedPersonName",
  "RegionalCouncil",
  "LocalCouncil",
  "IncidentType",
  "IncidentLocation",
  "AdditionalNotes",
  "ResponsibleTeam",
  "IncidentSeverity",
  "Incident_Status",
  "Remarks_NTF"
] as const;

const imageColumnKeys = ["Image1Path", "Image2Path", "Image3Path", "Image4Path", "Image5Path"] as const;

const imageColumnLabels = ["Image 1", "Image 2", "Image 3", "Image 4", "Image 5"] as const;

type ImageColumnKey = (typeof imageColumnKeys)[number];

type ExcelColumnDef = { key: string; header: string };

function getTextColumnHeader(key: string) {
  if (key === "Incident_Status") {
    return "Incident Status";
  }

  if (key === "Remarks_NTF") {
    return "NTF Remarks";
  }

  return key;
}

const excelColumns: ExcelColumnDef[] = [
  ...textColumns.map((key) => ({ key, header: getTextColumnHeader(key) })),
  ...imageColumnKeys.map((key, index) => ({ key, header: imageColumnLabels[index] }))
];

function formatIncidentStatus(value: ExportRow[string]) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "Open";
  }

  const raw = String(value).trim();
  const lower = raw.toLowerCase();

  if (lower === "open") {
    return "Open";
  }

  if (lower === "closed") {
    return "Closed";
  }

  if (lower === "in progress" || lower === "inprogress" || lower === "in_progress") {
    return "In Progress";
  }

  return raw;
}

function formatRemarksNtf(value: ExportRow[string]) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "—";
  }

  return String(value);
}

function formatCell(value: ExportRow[string]) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function formatGridTextCell(column: string, value: ExportRow[string]) {
  if (column === "Remarks_NTF") {
    return formatRemarksNtf(value);
  }

  if (column === "Incident_Status") {
    return formatIncidentStatus(value);
  }

  return formatCell(value);
}

function escapeExcelCell(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatExcelImageValue(value: ExportRow[string]): string {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "No Image";
  }

  return String(value).trim();
}

function formatExcelCellForExport(row: ExportRow, key: string): string {
  if ((imageColumnKeys as readonly string[]).includes(key)) {
    return escapeExcelCell(formatExcelImageValue(row[key]));
  }

  if (key === "Remarks_NTF") {
    const display = formatRemarksNtf(row[key]);
    return escapeExcelCell(display === "—" ? "-" : display);
  }

  if (key === "Incident_Status") {
    return escapeExcelCell(formatIncidentStatus(row[key]));
  }

  return escapeExcelCell(formatCell(row[key]));
}

type PreviewState = {
  src: string;
  title: string;
  loadError: boolean;
} | null;

function ExportImageCell({
  pathValue,
  label,
  onOpen
}: {
  pathValue: unknown;
  label: string;
  onOpen: (src: string, title: string) => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const path = typeof pathValue === "string" && pathValue.trim() ? pathValue.trim() : "";

  if (!path) {
    return <span className="export-cell--empty">—</span>;
  }

  return (
    <div className="export-image-cell">
      {!thumbFailed ? (
        <button
          type="button"
          className="export-image-cell__preview"
          onClick={() => onOpen(path, label)}
          aria-label={`Open ${label} in viewer`}
        >
          <img src={path} alt="" className="export-image-cell__thumb" onError={() => setThumbFailed(true)} />
        </button>
      ) : (
        <span className="export-image-cell__thumb-fallback" aria-hidden="true">
          IMG
        </span>
      )}
      <button type="button" className="export-image-cell__link" onClick={() => onOpen(path, label)}>
        View
      </button>
    </div>
  );
}

export default function ExportDataPage() {
  const [rows, setRows] = useState<ExportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [preview, setPreview] = useState<PreviewState>(null);

  const closePreview = useCallback(() => {
    setPreview(null);
  }, []);

  const openPreview = useCallback((src: string, title: string) => {
    setPreview({ src, title, loadError: false });
  }, []);

  useEffect(() => {
    if (!preview) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview, closePreview]);

  const exportToExcel = () => {
    const headerCells = excelColumns.map((col) => `<th>${escapeExcelCell(col.header)}</th>`).join("");
    const bodyRows = rows
      .map(
        (row) =>
          `<tr>${excelColumns.map((col) => `<td>${formatExcelCellForExport(row, col.key)}</td>`).join("")}</tr>`
      )
      .join("");
    const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table>
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `incident-reporting-export-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    async function loadRows() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/export-data", { cache: "no-store" });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error(
            "[Export API] Request failed:",
            response.status,
            response.statusText,
            detail ? detail.slice(0, 500) : ""
          );
          setRows([]);
          setMessage(
            "Export data could not be loaded. The server returned an error. Check the terminal logs and database connection."
          );
          return;
        }

        let data: { success?: boolean; message?: string; rows?: unknown };

        try {
          data = (await response.json()) as { success?: boolean; message?: string; rows?: unknown };
        } catch (parseError) {
          console.error("[Export API] Response was not valid JSON:", parseError);
          setRows([]);
          setMessage("Export data could not be loaded. The API returned an unexpected response.");
          return;
        }

        setRows(Array.isArray(data.rows) ? data.rows : []);
        setMessage(data.success ? "" : data.message || "Export data is temporarily unavailable.");
      } catch (error) {
        console.error("[Export API] Network error or request aborted:", error);
        setRows([]);
        setMessage(
          "Export data could not be loaded. Check your network connection and that the app is running (npm run dev on http://127.0.0.1:3000)."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadRows();
  }, []);

  return (
    <div className="app-shell">
      <SiteHeader />

      <div className={`workspace ${isSidebarExpanded ? "workspace--expanded" : "workspace--collapsed"}`}>
        <DashboardSidebar
          activeLabel="Export Data"
          isExpanded={isSidebarExpanded}
          onToggle={() => setIsSidebarExpanded((current) => !current)}
        />

        <main className="export-page">
          <section className="hero record-page__hero" aria-labelledby="export-title">
            <div>
              <p className="brand__eyebrow">Incident Reporting</p>
              <h2 id="export-title">Export data</h2>
              <p>Showing the latest 1000 incident reporting records from SQL Server.</p>
            </div>
          </section>

          <article className="panel export-panel">
            <div className="panel__header">
              <div className="export-panel__header">
                <div>
                  <h3>Incident Reporting Data</h3>
                  <p>{rows.length} record(s) loaded.</p>
                </div>
                <button className="primary-button" type="button" disabled={!rows.length} onClick={exportToExcel}>
                  Export into Excel
                </button>
              </div>
            </div>

            {message ? <div className="empty-state status-message--error">{message}</div> : null}
            {isLoading ? <div className="loading-state">Loading export data...</div> : null}

            {!isLoading && rows.length ? (
              <div className="table-wrap export-table-wrap">
                <table className="incidents-table export-table">
                  <thead>
                    <tr>
                      {textColumns.map((column) => (
                        <th key={column}>{getTextColumnHeader(column)}</th>
                      ))}
                      {imageColumnLabels.map((label) => (
                        <th key={label} className="export-table__th--image">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={String(row.IncidentID)}>
                        {textColumns.map((column) => (
                          <td key={`${row.IncidentID}-${column}`}>{formatGridTextCell(column, row[column])}</td>
                        ))}
                        {imageColumnKeys.map((key, index) => (
                          <td key={`${row.IncidentID}-${key}`} className="export-table__cell--image">
                            <ExportImageCell
                              pathValue={row[key as keyof ExportRow]}
                              label={imageColumnLabels[index]}
                              onOpen={openPreview}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {!isLoading && !rows.length && !message ? <div className="empty-state">No export records found.</div> : null}
          </article>
        </main>
      </div>

      {preview ? (
        <div
          className="export-image-modal-overlay"
          role="presentation"
          onClick={closePreview}
        >
          <div
            className="export-image-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-image-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="export-image-modal__header">
              <h3 id="export-image-modal-title">{preview.title}</h3>
              <button type="button" className="export-image-modal__close" aria-label="Close" onClick={closePreview}>
                Close
              </button>
            </div>
            <div className="export-image-modal__body">
              {preview.loadError ? (
                <p className="export-image-modal__error">This image could not be loaded.</p>
              ) : (
                <img
                  src={preview.src}
                  alt={preview.title}
                  className="export-image-modal__img"
                  onError={() => setPreview((current) => (current ? { ...current, loadError: true } : null))}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      <SiteFooter />
    </div>
  );
}
