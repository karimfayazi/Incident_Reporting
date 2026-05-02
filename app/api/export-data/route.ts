import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
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

export async function GET(request: Request) {
  const user = await getUser();

  if (user?.role !== "admin") {
    return NextResponse.json({ success: false, message: "Forbidden", rows: [], total: 0 }, { status: 403 });
  }

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

    const page = Math.max(1, Number(getParam(url, "page")) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(getParam(url, "pageSize")) || 25));
    const sortBy = getParam(url, "sortBy") || "CreatedDate";
    const sortOrder = getParam(url, "sortOrder") === "asc" ? "ASC" : "DESC";
    const search = getParam(url, "search");

    const allowedSortColumns: Record<string, string> = {
      IncidentID: "IncidentID",
      Darbar_Location: "Darbar_Location",
      VolunteerName: "VolunteerName",
      VolunteerPhone: "VolunteerPhone",
      IncidentCategory: "IncidentCategory",
      IncidentTitle: "IncidentTitle",
      Region: "Region",
      LocalCouncil: "LocalCouncil",
      VillageLocation: "VillageLocation",
      ResponsibleTeam: "ResponsibleTeam",
      IncidentSeverity: "IncidentSeverity",
      Incident_Status: "Incident_Status",
      CreatedDate: "CreatedDate",
      UpdatedDate: "UpdatedDate"
    };
    const sortCol = allowedSortColumns[sortBy] || "CreatedDate";

    const searchClause = search
      ? ` AND (
          IncidentTitle LIKE @Search
          OR VolunteerName LIKE @Search
          OR Region LIKE @Search
          OR LocalCouncil LIKE @Search
          OR Darbar_Location LIKE @Search
          OR IncidentDescription LIKE @Search
          OR VillageLocation LIKE @Search
          OR CAST(IncidentID AS NVARCHAR(20)) LIKE @Search
        )`
      : "";
    const fullWhere = whereClause + searchClause;

    const pool = await getSqlPool();

    const makeRequest = () => {
      const req = pool.request();
      for (const i of inputs) req.input(i.name, i.sqlType, i.value);
      if (search) req.input("Search", sql.NVarChar(400), `%${search}%`);
      return req;
    };

    const [countResult, dataResult, optionsResult] = await Promise.all([
      makeRequest().query(`SELECT COUNT(1) AS total FROM ${TABLE} WHERE ${fullWhere};`),
      makeRequest().query(`
        SELECT
          IncidentID,
          Darbar_Location,
          VolunteerName,
          VolunteerPhone,
          IncidentCategory,
          IncidentTitle,
          Region,
          LocalCouncil,
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
        WHERE ${fullWhere}
        ORDER BY ${sortCol} ${sortOrder}
        OFFSET ${(page - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
      `),
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
    ]);

    const total = Number(countResult.recordset[0]?.total ?? 0);

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
      rows: dataResult.recordset,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
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
    console.error("Export API error:", error);
    return NextResponse.json({
      success: false,
      message: "Export data could not be loaded. Please try again.",
      rows: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
      filterOptions: { darbarLocations: [], regions: [], localCouncils: [], categories: [], severities: [], statuses: [], regionsByDarbar: {}, councilsByRegion: {} }
    });
  }
}
