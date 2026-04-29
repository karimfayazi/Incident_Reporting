import { NextResponse } from "next/server";
import { getSqlPool, getSqlErrorDetails, sql } from "@/lib/db";

export const runtime = "nodejs";

type QueryInput = {
  name: string;
  sqlType: sql.ISqlType;
  value: string | Date;
};

type FilterOptionRow = {
  RegionalCouncil: string | null;
  LocalCouncil: string | null;
  IncidentCategory: string | null;
  IncidentSeverity: string | null;
  IncidentType: string | null;
  ResponsibleTeam: string | null;
};

const emptyDashboard = {
  success: false,
  message: "Dashboard data is temporarily unavailable.",
  kpis: {
    totalIncidents: 0,
    todayIncidents: 0,
    monthlyIncidentCount: 0,
    criticalIncidents: 0,
    highSeverityIncidents: 0,
    activeIncidents: 0
  },
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
  insights: [
    "Dashboard data is temporarily unavailable. Please verify the SQL Server connection."
  ]
};

function getParam(url: URL, key: string) {
  return url.searchParams.get(key)?.trim() ?? "";
}

function addOptionalFilter(
  where: string[],
  inputs: QueryInput[],
  key: string,
  column: string,
  value: string
) {
  if (!value) {
    return;
  }

  where.push(`${column} = @${key}`);
  inputs.push({ name: key, sqlType: sql.NVarChar(400), value });
}

function isValidDate(value: string) {
  return value && !Number.isNaN(new Date(value).getTime());
}

function formatPercent(current: number, previous: number) {
  if (!previous && current) {
    return 100;
  }

  if (!previous) {
    return 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function getTrendStatus(current: number, previous: number) {
  if (current < previous) {
    return "Improving";
  }

  if (current > previous) {
    return "Declining";
  }

  return "Stable";
}

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

    addOptionalFilter(where, inputs, "RegionalCouncil", "RegionalCouncil", getParam(url, "regionalCouncil"));
    addOptionalFilter(where, inputs, "LocalCouncil", "LocalCouncil", getParam(url, "localCouncil"));
    addOptionalFilter(where, inputs, "IncidentCategory", "IncidentCategory", getParam(url, "incidentCategory"));
    addOptionalFilter(where, inputs, "IncidentSeverity", "IncidentSeverity", getParam(url, "incidentSeverity"));
    addOptionalFilter(where, inputs, "IncidentType", "IncidentType", getParam(url, "incidentType"));
    addOptionalFilter(where, inputs, "ResponsibleTeam", "ResponsibleTeam", getParam(url, "responsibleTeam"));

    const whereClause = where.join(" AND ");
    const pool = await getSqlPool();

    const runQuery = (query: string) => {
      const queryRequest = pool.request();

      inputs.forEach((input) => {
        queryRequest.input(input.name, input.sqlType, input.value);
      });

      return queryRequest.query(query);
    };

    const [
      kpiResult,
      categoryResult,
      severityResult,
      regionalResult,
      localResult,
      incidentTypeResult,
      incidentStatusResult,
      monthlyResult,
      teamResult,
      criticalHighResult,
      recentResult,
      optionsResult
    ] = await Promise.all([
      runQuery(`
      SELECT
        COUNT(1) AS totalIncidents,
        SUM(CASE WHEN CONVERT(date, CreatedDate) = CONVERT(date, GETDATE()) THEN 1 ELSE 0 END) AS todayIncidents,
        SUM(CASE WHEN YEAR(CreatedDate) = YEAR(GETDATE()) AND MONTH(CreatedDate) = MONTH(GETDATE()) THEN 1 ELSE 0 END) AS monthlyIncidentCount,
        SUM(CASE WHEN IncidentSeverity = 'Critical' THEN 1 ELSE 0 END) AS criticalIncidents,
        SUM(CASE WHEN IncidentSeverity = 'High' THEN 1 ELSE 0 END) AS highSeverityIncidents,
        SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS activeIncidents,
        SUM(CASE WHEN YEAR(CreatedDate) = YEAR(GETDATE()) AND MONTH(CreatedDate) = MONTH(GETDATE()) THEN 1 ELSE 0 END) AS currentMonth,
        SUM(CASE WHEN CreatedDate >= DATEADD(month, DATEDIFF(month, 0, GETDATE()) - 1, 0)
                  AND CreatedDate < DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0) THEN 1 ELSE 0 END) AS previousMonth
      FROM [rifiiorg].[Incident_Reporting]
      WHERE ${whereClause};
    `),
      runQuery(`
      SELECT ISNULL(NULLIF(IncidentCategory, ''), 'Unspecified') AS name, COUNT(1) AS value
      FROM [rifiiorg].[Incident_Reporting]
      WHERE ${whereClause}
      GROUP BY ISNULL(NULLIF(IncidentCategory, ''), 'Unspecified')
      ORDER BY value DESC;
    `),
      runQuery(`
      SELECT ISNULL(NULLIF(IncidentSeverity, ''), 'Unspecified') AS name, COUNT(1) AS value
      FROM [rifiiorg].[Incident_Reporting]
      WHERE ${whereClause}
      GROUP BY ISNULL(NULLIF(IncidentSeverity, ''), 'Unspecified')
      ORDER BY CASE ISNULL(NULLIF(IncidentSeverity, ''), 'Unspecified')
        WHEN 'Low' THEN 1 WHEN 'Medium' THEN 2 WHEN 'High' THEN 3 WHEN 'Critical' THEN 4 ELSE 5 END;
    `),
      runQuery(`
      SELECT ISNULL(NULLIF(RegionalCouncil, ''), 'Unspecified') AS name, COUNT(1) AS value
      FROM [rifiiorg].[Incident_Reporting]
      WHERE ${whereClause}
      GROUP BY ISNULL(NULLIF(RegionalCouncil, ''), 'Unspecified')
      ORDER BY value DESC;
    `),
      runQuery(`
      SELECT TOP (10) ISNULL(NULLIF(LocalCouncil, ''), 'Unspecified') AS name, COUNT(1) AS value
      FROM [rifiiorg].[Incident_Reporting]
      WHERE ${whereClause}
      GROUP BY ISNULL(NULLIF(LocalCouncil, ''), 'Unspecified')
      ORDER BY value DESC;
    `),
      runQuery(`
      SELECT TOP (10) ISNULL(NULLIF(IncidentType, ''), 'Unspecified') AS name, COUNT(1) AS value
      FROM [rifiiorg].[Incident_Reporting]
      WHERE ${whereClause}
      GROUP BY ISNULL(NULLIF(IncidentType, ''), 'Unspecified')
      ORDER BY value DESC;
    `),
      runQuery(`
      SELECT
        ISNULL(Incident_Status, 'Open') AS name,
        COUNT(1) AS value
      FROM [rifiiorg].[Incident_Reporting]
      WHERE ${whereClause}
      GROUP BY ISNULL(Incident_Status, 'Open')
      ORDER BY CASE ISNULL(Incident_Status, 'Open')
        WHEN 'Open' THEN 1
        WHEN 'In Progress' THEN 2
        WHEN 'Closed' THEN 3
        ELSE 4
      END;
    `),
      runQuery(`
      SELECT CONVERT(VARCHAR(7), CreatedDate, 120) AS month, COUNT(1) AS incidents
      FROM [rifiiorg].[Incident_Reporting]
      WHERE ${whereClause}
      GROUP BY CONVERT(VARCHAR(7), CreatedDate, 120)
      ORDER BY month;
    `),
      runQuery(`
      SELECT
        ISNULL(NULLIF(ResponsibleTeam, ''), 'Unassigned') AS team,
        SUM(CASE WHEN IncidentSeverity = 'Low' THEN 1 ELSE 0 END) AS Low,
        SUM(CASE WHEN IncidentSeverity = 'Medium' THEN 1 ELSE 0 END) AS Medium,
        SUM(CASE WHEN IncidentSeverity = 'High' THEN 1 ELSE 0 END) AS High,
        SUM(CASE WHEN IncidentSeverity = 'Critical' THEN 1 ELSE 0 END) AS Critical,
        COUNT(1) AS Total
      FROM [rifiiorg].[Incident_Reporting]
      WHERE ${whereClause}
      GROUP BY ISNULL(NULLIF(ResponsibleTeam, ''), 'Unassigned')
      ORDER BY Total DESC;
    `),
      runQuery(`
      SELECT TOP (20)
        IncidentID,
        IncidentCategory,
        RegionalCouncil,
        LocalCouncil,
        ResponsibleTeam,
        IncidentSeverity,
        CreatedDate
      FROM [rifiiorg].[Incident_Reporting]
      WHERE ${whereClause} AND IncidentSeverity IN ('High', 'Critical')
      ORDER BY CreatedDate DESC, IncidentID DESC;
    `),
      runQuery(`
      SELECT TOP (20)
        IncidentID,
        VolunteerName,
        IncidentCategory,
        RegionalCouncil,
        LocalCouncil,
        IncidentSeverity,
        CreatedDate
      FROM [rifiiorg].[Incident_Reporting]
      WHERE ${whereClause}
      ORDER BY CreatedDate DESC, IncidentID DESC;
    `),
      pool.request().query(`
      SELECT
        RegionalCouncil,
        LocalCouncil,
        IncidentCategory,
        IncidentSeverity,
        IncidentType,
        ResponsibleTeam
      FROM [rifiiorg].[Incident_Reporting]
      WHERE IsActive = 1;
    `)
    ]);

    const kpis = kpiResult.recordset[0] ?? {};
    const currentMonth = Number(kpis.currentMonth ?? 0);
    const previousMonth = Number(kpis.previousMonth ?? 0);
    const topCategory = categoryResult.recordset[0];
    const topRegion = regionalResult.recordset[0];
    const topTeam = teamResult.recordset[0];
    const totalIncidents = Number(kpis.totalIncidents ?? 0);
    const topCategoryPercent = totalIncidents && topCategory ? Math.round((Number(topCategory.value) / totalIncidents) * 100) : 0;
    const percentChange = formatPercent(currentMonth, previousMonth);
    const status = getTrendStatus(currentMonth, previousMonth);
    const optionRows = optionsResult.recordset as FilterOptionRow[];
    const uniqueOptions = (field: keyof FilterOptionRow) =>
      Array.from(new Set(optionRows.map((row) => row[field]).filter((value): value is string => Boolean(value)))).sort();
    const localCouncilsByRegion = optionRows.reduce<Record<string, string[]>>((acc, row) => {
      if (!row.RegionalCouncil || !row.LocalCouncil) {
        return acc;
      }

      acc[row.RegionalCouncil] = Array.from(new Set([...(acc[row.RegionalCouncil] ?? []), row.LocalCouncil])).sort();
      return acc;
    }, {});
    const insights = [
      topCategory
        ? `Majority of incidents are related to ${topCategory.name} (${topCategoryPercent}%).`
        : "No incident category pattern is available yet.",
      topRegion
        ? `${topRegion.name} has the highest number of incidents.`
        : "No regional incident activity is available yet.",
      `Critical incidents this month: ${Number(kpis.criticalIncidents ?? 0)}.`,
      `Current month vs previous month trend is ${status.toLowerCase()} (${percentChange}%).`,
      topTeam
        ? `${topTeam.team} has the highest responsible team workload.`
        : "No responsible team workload is available yet."
    ];

    return NextResponse.json({
      success: true,
      kpis: {
        totalIncidents,
        todayIncidents: Number(kpis.todayIncidents ?? 0),
        monthlyIncidentCount: Number(kpis.monthlyIncidentCount ?? 0),
        criticalIncidents: Number(kpis.criticalIncidents ?? 0),
        highSeverityIncidents: Number(kpis.highSeverityIncidents ?? 0),
        activeIncidents: Number(kpis.activeIncidents ?? 0)
      },
      monthComparison: {
        currentMonth,
        previousMonth,
        percentChange,
        status
      },
      categoryTotals: categoryResult.recordset,
      severityTotals: severityResult.recordset,
      regionalTotals: regionalResult.recordset,
      localCouncilTotals: localResult.recordset,
      incidentTypeTotals: incidentTypeResult.recordset,
      incidentStatusTotals: incidentStatusResult.recordset,
      monthlyTrend: monthlyResult.recordset,
      teamWorkload: teamResult.recordset,
      criticalHighIncidents: criticalHighResult.recordset,
      recentIncidents: recentResult.recordset,
      filterOptions: {
        regionalCouncils: uniqueOptions("RegionalCouncil"),
        localCouncils: uniqueOptions("LocalCouncil"),
        localCouncilsByRegion,
        categories: uniqueOptions("IncidentCategory"),
        severities: uniqueOptions("IncidentSeverity"),
        incidentTypes: uniqueOptions("IncidentType"),
        responsibleTeams: uniqueOptions("ResponsibleTeam")
      },
      insights
    });
  } catch (error) {
    const sqlError = getSqlErrorDetails(error);
    console.error("Dashboard fetch failed:", sqlError);
    return NextResponse.json(emptyDashboard);
  }
}
