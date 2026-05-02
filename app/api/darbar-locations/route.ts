import { NextResponse } from "next/server";
import { getSqlErrorDetails, getSqlPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pool = await getSqlPool();
    const result = await pool.request().query(`
      SELECT DISTINCT
        LTRIM(RTRIM(DidargahName)) AS DidargahName,
        LTRIM(RTRIM(RegionalCouncilName)) AS RegionalCouncilName,
        LTRIM(RTRIM(LocalCouncilName)) AS LocalCouncilName
      FROM [_rifiiorg_db].[rifiiorg].[View_RC_LC_List]
      WHERE NULLIF(LTRIM(RTRIM(DidargahName)), '') IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(RegionalCouncilName)), '') IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(LocalCouncilName)), '') IS NOT NULL
      ORDER BY
        LTRIM(RTRIM(DidargahName)),
        LTRIM(RTRIM(RegionalCouncilName)),
        LTRIM(RTRIM(LocalCouncilName));
    `);

    return NextResponse.json({
      success: true,
      rows: result.recordset
    });
  } catch (error) {
    console.error("Darbar location lookup failed:", getSqlErrorDetails(error));
    return NextResponse.json(
      {
        success: false,
        message: "Darbar, Regional Council, and Local Council list could not be loaded.",
        rows: []
      },
      { status: 500 }
    );
  }
}
