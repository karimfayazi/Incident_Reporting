import { NextResponse } from "next/server";
import { getSqlErrorDetails, getSqlPool, sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const regionalCouncilId = Number(url.searchParams.get("regionalCouncilId"));

  if (!Number.isInteger(regionalCouncilId) || regionalCouncilId <= 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Regional Council is required.",
        localCouncils: []
      },
      { status: 400 }
    );
  }

  try {
    const pool = await getSqlPool();
    const result = await pool
      .request()
      .input("RegionalCouncilId", sql.Int, regionalCouncilId)
      .query(`
        SELECT
          LocalCouncilId,
          LocalCouncilName
        FROM [_rifiiorg_db].[rifiiorg].[LocalCouncil]
        WHERE RegionalCouncilId = @RegionalCouncilId
        ORDER BY LocalCouncilName;
      `);

    return NextResponse.json({
      success: true,
      localCouncils: result.recordset
    });
  } catch (error) {
    console.error("Local council lookup failed:", getSqlErrorDetails(error));
    return NextResponse.json(
      {
        success: false,
        message: "Local Councils could not be loaded.",
        localCouncils: []
      },
      { status: 500 }
    );
  }
}
