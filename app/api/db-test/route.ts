import { NextResponse } from "next/server";
import { getSqlPool, getSqlErrorDetails } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pool = await getSqlPool();
    const result = await pool.request().query(`
      SELECT
        DB_NAME() AS databaseName,
        GETDATE() AS serverDateTime;
    `);

    const record = result.recordset[0] ?? {};

    return NextResponse.json({
      success: true,
      database: record.databaseName,
      serverDateTime: record.serverDateTime
    });
  } catch (error) {
    const sqlError = getSqlErrorDetails(error);

    console.error("DB Test Error:", sqlError);
    return NextResponse.json(
      {
        success: false,
        message: sqlError.message,
        code: sqlError.code
      },
      { status: 200 }
    );
  }
}
