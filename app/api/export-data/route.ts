import { NextResponse } from "next/server";
import { getSqlPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pool = await getSqlPool();
    const result = await pool.request().query(`
      SELECT TOP (1000)
        IncidentID,
        VolunteerName,
        VolunteerPhone,
        IncidentCategory,
        ConcernedPersonName,
        RegionalCouncil,
        LocalCouncil,
        IncidentType,
        IncidentLocation,
        AdditionalNotes,
        ResponsibleTeam,
        AttachmentPath,
        IncidentSeverity,
        Incident_Status,
        Remarks_NTF,
        CreatedBy,
        CreatedDate,
        UpdatedBy,
        UpdatedDate,
        IsActive,
        Image1Path,
        Image2Path,
        Image3Path,
        Image4Path,
        Image5Path
      FROM [_rifiiorg_db].[rifiiorg].[Incident_Reporting]
      ORDER BY IncidentID DESC;
    `);

    return NextResponse.json({
      success: true,
      rows: result.recordset
    });
  } catch (error) {
    console.error("SQL Server connection/query error:", error);
    return NextResponse.json({
      success: false,
      message: "Dashboard data is temporarily unavailable.",
      rows: []
    });
  }
}
