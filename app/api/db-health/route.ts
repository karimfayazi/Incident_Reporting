import { NextResponse } from "next/server";

import {
  getDbEnvPresenceReport,
  getSqlErrorDetails,
  getSqlPool
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Safe connectivity check — never exposes password or secrets */
export async function GET() {
  const presence = getDbEnvPresenceReport();
  const hasServer = presence.DB_SERVER || presence.DB_HOST;
  const hasDatabase = presence.DB_DATABASE || presence.DB_NAME;
  const hasUser = presence.DB_USER;
  const hasPassword = presence.DB_PASSWORD;

  const envOk = !!(hasServer && hasDatabase && hasUser && hasPassword);

  if (!envOk) {
    return NextResponse.json(
      {
        ok: false,
        envConfigured: false,
        hasServer,
        hasDatabase,
        hasUser,
        hasPassword,
        queryExecuted: false,
        message:
          "Database env vars are incomplete. Set DB_SERVER or DB_HOST, DB_DATABASE or DB_NAME, DB_USER, DB_PASSWORD in hosting settings and redeploy."
      },
      { status: 503 }
    );
  }

  try {
    const pool = await getSqlPool();
    await pool.request().query("SELECT 1 AS ok");
    return NextResponse.json({
      ok: true,
      envConfigured: true,
      hasServer,
      hasDatabase,
      hasUser,
      hasPassword,
      queryExecuted: true,
      message: "Database connection OK."
    });
  } catch (error) {
    const details = getSqlErrorDetails(error);
    return NextResponse.json(
      {
        ok: false,
        envConfigured: true,
        hasServer,
        hasDatabase,
        hasUser,
        hasPassword,
        queryExecuted: false,
        code: details.code,
        message: details.message
      },
      { status: 503 }
    );
  }
}
