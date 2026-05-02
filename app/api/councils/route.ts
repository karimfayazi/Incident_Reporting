import { NextResponse } from "next/server";
import { getResolvedCouncilMapWithSource } from "@/lib/council-db";
import { getSqlErrorDetails } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { map, source } = await getResolvedCouncilMapWithSource();
    return NextResponse.json({
      success: true,
      map,
      source
    });
  } catch (error) {
    const sqlError = getSqlErrorDetails(error);
    console.error("Council lookup error:", sqlError);
    return NextResponse.json(
      {
        success: false,
        message: sqlError.message,
        code: sqlError.code
      },
      { status: 503 }
    );
  }
}
