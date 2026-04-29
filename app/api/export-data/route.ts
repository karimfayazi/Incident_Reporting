import { NextResponse } from "next/server";
import { getSqlPool, getSqlErrorDetails } from "@/lib/db";

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
        Image1Path,
        Image2Path,
        Image3Path,
        Image4Path,
        Image5Path
      FROM [rifiiorg].[Incident_Reporting]
      ORDER BY IncidentID DESC;
    `);

    return NextResponse.json({
      success: true,
      rows: result.recordset
    });
  } catch (error) {
    const sqlError = getSqlErrorDetails(error);

    console.error("Export Data Error:", sqlError);
    return NextResponse.json({
      success: false,
      message: "Export data is temporarily unavailable.",
      rows: []
    });
  }
}
