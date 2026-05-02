import { NextResponse } from "next/server";
import { getSqlPool, sql } from "@/lib/db";

export const runtime = "nodejs";

const TABLE = "[_rifiiorg_db].[rifiiorg].[NC_RI_Incident_Reporting]";

type QueryInput = {
  name: string;
  sqlType: sql.ISqlType;
  value: string | Date;
};

function getParam(url: URL, key: string) {
  return url.searchParams.get(key)?.trim() ?? "";
}

function addFilter(where: string[], inputs: QueryInput[], key: string, column: string, value: string) {
  if (!value) return;
  where.push(`${column} = @${key}`);
  inputs.push({ name: key, sqlType: sql.NVarChar(400), value });
}

function isValidDate(value: string) {
  return value && !Number.isNaN(new Date(value).getTime());
}

const EMPTY_RESPONSE = {
  success: true,
  kpis: { totalIncidents: 0, todayIncidents: 0, openIncidents: 0, closedIncidents: 0, highIncidents: 0, criticalIncidents: 0 },
  severityTotals: [],
  statusTotals: [],
  regionTotals: [],
  darbarTotals: [],
  localCouncilTotals: [],
  regionCouncilSummary: [],
  monthlyTrend: [],
  table: { rows: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
  filterOptions: { darbarLocations: [], regions: [], localCouncils: [], categories: [], severities: [], statuses: [], regionsByDarbar: {}, councilsByRegion: {} }
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const where = ["IsActive = 1"];
    const inputs: QueryInput[] = [];

    const dateFrom = getParam(url, "dateFrom");
    const dateTo = getParam(url, "dateTo");

    if (isValidDate(dateFrom)) {
      where.push("CreatedDate >= @DateFrom");
      inputs.push({ name: "DateFrom", sqlType: sql.DateTime2(), value: new Date(dateFrom) });
    }
    if (isValidDate(dateTo)) {
      where.push("CreatedDate < DATEADD(day, 1, @DateTo)");
      inputs.push({ name: "DateTo", sqlType: sql.DateTime2(), value: new Date(dateTo) });
    }

    addFilter(where, inputs, "DarbarLocation", "Darbar_Location", getParam(url, "darbarLocation"));
    addFilter(where, inputs, "Region", "Region", getParam(url, "region"));
    addFilter(where, inputs, "LocalCouncil", "LocalCouncil", getParam(url, "localCouncil"));
    addFilter(where, inputs, "IncidentCategory", "IncidentCategory", getParam(url, "incidentCategory"));
    addFilter(where, inputs, "IncidentSeverity", "IncidentSeverity", getParam(url, "incidentSeverity"));
    addFilter(where, inputs, "IncidentStatus", "Incident_Status", getParam(url, "incidentStatus"));

    const whereClause = where.join(" AND ");
    const pool = await getSqlPool();

    const makeRequest = () => {
      const req = pool.request();
      for (const i of inputs) req.input(i.name, i.sqlType, i.value);
      return req;
    };

    const page = Math.max(1, Number(getParam(url, "page")) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(getParam(url, "pageSize")) || 20));
    const sortBy = getParam(url, "sortBy") || "CreatedDate";
    const sortOrder = getParam(url, "sortOrder") === "asc" ? "ASC" : "DESC";
    const search = getParam(url, "search");

    const allowedSortColumns: Record<string, string> = {
      IncidentID: "IncidentID",
      Darbar_Location: "Darbar_Location",
      Region: "Region",
      LocalCouncil: "LocalCouncil",
      IncidentTitle: "IncidentTitle",
      IncidentSeverity: "IncidentSeverity",
      Incident_Status: "Incident_Status",
      CreatedDate: "CreatedDate"
    };
    const sortCol = allowedSortColumns[sortBy] || "CreatedDate";

    const makeTableRequest = () => {
      const req = pool.request();
      for (const i of inputs) req.input(i.name, i.sqlType, i.value);
      if (search) req.input("Search", sql.NVarChar(400), `%${search}%`);
      return req;
    };

    const searchClause = search
      ? ` AND (
          IncidentTitle LIKE @Search
          OR VolunteerName LIKE @Search
          OR Region LIKE @Search
          OR LocalCouncil LIKE @Search
          OR Darbar_Location LIKE @Search
          OR CAST(IncidentID AS NVARCHAR(20)) LIKE @Search
        )`
      : "";
    const tableWhere = whereClause + searchClause;

    /* ------------------------------------------------------------ */
    /*  Run all queries safely — each wrapped individually           */
    /* ------------------------------------------------------------ */

    type SafeResult = { recordset: Record<string, unknown>[] };
    const empty: SafeResult = { recordset: [] };

    async function safeQuery(label: string, queryFn: () => Promise<sql.IResult<Record<string, unknown>>>): Promise<SafeResult> {
      try {
        return await queryFn();
      } catch (err) {
        console.error(`[Dashboard] ${label} query failed:`, err);
        return empty;
      }
    }

    const [
      kpiResult,
      severityResult,
      statusResult,
      regionResult,
      darbarResult,
      localCouncilResult,
      regionCouncilResult,
      monthlyResult,
      tableCountResult,
      tableResult,
      optionsResult
    ] = await Promise.all([
      safeQuery("KPI", () =>
        makeRequest().query(`
          SELECT
            COUNT(1) AS totalIncidents,
            SUM(CASE WHEN CONVERT(date, CreatedDate) = CONVERT(date, GETDATE()) THEN 1 ELSE 0 END) AS todayIncidents,
            SUM(CASE WHEN ISNULL(Incident_Status, 'Open') = 'Open' OR Incident_Status = 'In Progress' THEN 1 ELSE 0 END) AS openIncidents,
            SUM(CASE WHEN Incident_Status = 'Closed' THEN 1 ELSE 0 END) AS closedIncidents,
            SUM(CASE WHEN IncidentSeverity = 'High' THEN 1 ELSE 0 END) AS highIncidents,
            SUM(CASE WHEN IncidentSeverity = 'Critical' THEN 1 ELSE 0 END) AS criticalIncidents
          FROM ${TABLE}
          WHERE ${whereClause};
        `)
      ),
      safeQuery("Severity", () =>
        makeRequest().query(`
          SELECT ISNULL(NULLIF(IncidentSeverity, ''), 'Unspecified') AS name, COUNT(1) AS value
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY ISNULL(NULLIF(IncidentSeverity, ''), 'Unspecified')
          ORDER BY CASE ISNULL(NULLIF(IncidentSeverity, ''), 'Unspecified')
            WHEN 'Low' THEN 1 WHEN 'Medium' THEN 2 WHEN 'High' THEN 3 WHEN 'Critical' THEN 4 ELSE 5 END;
        `)
      ),
      safeQuery("Status", () =>
        makeRequest().query(`
          SELECT ISNULL(Incident_Status, 'Open') AS name, COUNT(1) AS value
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY ISNULL(Incident_Status, 'Open')
          ORDER BY CASE ISNULL(Incident_Status, 'Open')
            WHEN 'Open' THEN 1 WHEN 'In Progress' THEN 2 WHEN 'Closed' THEN 3 ELSE 4 END;
        `)
      ),
      safeQuery("Region", () =>
        makeRequest().query(`
          SELECT ISNULL(NULLIF(Region, ''), 'Unspecified') AS name, COUNT(1) AS value
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY ISNULL(NULLIF(Region, ''), 'Unspecified')
          ORDER BY value DESC;
        `)
      ),
      safeQuery("Darbar", () =>
        makeRequest().query(`
          SELECT ISNULL(NULLIF(Darbar_Location, ''), 'Unspecified') AS name, COUNT(1) AS value
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY ISNULL(NULLIF(Darbar_Location, ''), 'Unspecified')
          ORDER BY value DESC;
        `)
      ),
      safeQuery("LocalCouncil", () =>
        makeRequest().query(`
          SELECT ISNULL(NULLIF(LocalCouncil, ''), 'Unspecified') AS name, COUNT(1) AS value
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY ISNULL(NULLIF(LocalCouncil, ''), 'Unspecified')
          ORDER BY value DESC;
        `)
      ),
      safeQuery("RegionCouncil", () =>
        makeRequest().query(`
          SELECT
            ISNULL(NULLIF(Region, ''), 'Unspecified') AS Region,
            ISNULL(NULLIF(LocalCouncil, ''), 'Unspecified') AS LocalCouncil,
            COUNT(1) AS TotalIncidents
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY ISNULL(NULLIF(Region, ''), 'Unspecified'), ISNULL(NULLIF(LocalCouncil, ''), 'Unspecified')
          ORDER BY Region, LocalCouncil;
        `)
      ),
      safeQuery("Monthly", () =>
        makeRequest().query(`
          SELECT
            CONVERT(VARCHAR(7), CreatedDate, 120) AS month,
            COUNT(1) AS incidents
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY CONVERT(VARCHAR(7), CreatedDate, 120)
          ORDER BY month;
        `)
      ),
      safeQuery("TableCount", () =>
        makeTableRequest().query(`
          SELECT COUNT(1) AS total
          FROM ${TABLE}
          WHERE ${tableWhere};
        `)
      ),
      safeQuery("Table", () =>
        makeTableRequest().query(`
          SELECT
            IncidentID,
            Darbar_Location,
            Region,
            LocalCouncil,
            VolunteerName,
            VolunteerPhone,
            IncidentCategory,
            IncidentTitle,
            VillageLocation,
            IncidentDescription,
            IncidentPlace,
            ResponsibleTeam,
            IncidentSeverity,
            ISNULL(Incident_Status, 'Open') AS Incident_Status,
            CreatedDate,
            UpdatedDate,
            Image1,
            Image2,
            Image3
          FROM ${TABLE}
          WHERE ${tableWhere}
          ORDER BY ${sortCol} ${sortOrder}
          OFFSET ${(page - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
        `)
      ),
      safeQuery("Options", () =>
        pool.request().query(`
          SELECT DISTINCT
            Darbar_Location,
            Region,
            LocalCouncil,
            IncidentCategory,
            IncidentSeverity,
            Incident_Status
          FROM ${TABLE}
          WHERE IsActive = 1;
        `)
      )
    ]);

    const kpis = kpiResult.recordset[0] ?? {};
    const totalTableRows = Number(tableCountResult.recordset[0]?.total ?? 0);

    type OptionRow = {
      Darbar_Location: string | null;
      Region: string | null;
      LocalCouncil: string | null;
      IncidentCategory: string | null;
      IncidentSeverity: string | null;
      Incident_Status: string | null;
    };
    const optionRows = optionsResult.recordset as OptionRow[];

    const unique = (field: keyof OptionRow) =>
      Array.from(new Set(optionRows.map((r) => r[field]).filter((v): v is string => !!v?.trim()))).sort();

    const regionsByDarbar: Record<string, string[]> = {};
    const councilsByRegion: Record<string, string[]> = {};
    for (const row of optionRows) {
      if (row.Darbar_Location && row.Region) {
        const set = regionsByDarbar[row.Darbar_Location] ?? [];
        if (!set.includes(row.Region)) set.push(row.Region);
        regionsByDarbar[row.Darbar_Location] = set;
      }
      if (row.Region && row.LocalCouncil) {
        const set = councilsByRegion[row.Region] ?? [];
        if (!set.includes(row.LocalCouncil)) set.push(row.LocalCouncil);
        councilsByRegion[row.Region] = set;
      }
    }
    for (const key of Object.keys(regionsByDarbar)) regionsByDarbar[key].sort();
    for (const key of Object.keys(councilsByRegion)) councilsByRegion[key].sort();

    return NextResponse.json({
      success: true,
      kpis: {
        totalIncidents: Number(kpis.totalIncidents ?? 0),
        todayIncidents: Number(kpis.todayIncidents ?? 0),
        openIncidents: Number(kpis.openIncidents ?? 0),
        closedIncidents: Number(kpis.closedIncidents ?? 0),
        highIncidents: Number(kpis.highIncidents ?? 0),
        criticalIncidents: Number(kpis.criticalIncidents ?? 0)
      },
      severityTotals: severityResult.recordset,
      statusTotals: statusResult.recordset,
      regionTotals: regionResult.recordset,
      darbarTotals: darbarResult.recordset,
      localCouncilTotals: localCouncilResult.recordset,
      regionCouncilSummary: regionCouncilResult.recordset,
      monthlyTrend: monthlyResult.recordset,
      table: {
        rows: tableResult.recordset,
        total: totalTableRows,
        page,
        pageSize,
        totalPages: Math.ceil(totalTableRows / pageSize)
      },
      filterOptions: {
        darbarLocations: unique("Darbar_Location"),
        regions: unique("Region"),
        localCouncils: unique("LocalCouncil"),
        categories: unique("IncidentCategory"),
        severities: unique("IncidentSeverity"),
        statuses: unique("Incident_Status"),
        regionsByDarbar,
        councilsByRegion
      }
    });
  } catch (error) {
    console.error("Dashboard API fatal error:", error);
    return NextResponse.json(EMPTY_RESPONSE);
  }
}
