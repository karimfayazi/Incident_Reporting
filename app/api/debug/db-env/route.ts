import { NextResponse } from "next/server";

import { getDbEnvPresenceReport } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Safe deployment check: only whether each DB-related env variable is defined (truthy after trim).
 * Never returns secret values.
 *
 * Enable on production by setting DEBUG_DB_ENV=true on the host (e.g. Vercel env), then redeploy.
 * Allowed without the flag while NODE_ENV=development (.env.local scenarios).
 */
export async function GET() {
  const allow =
    process.env.NODE_ENV !== "production" || String(process.env.DEBUG_DB_ENV || "").toLowerCase() === "true";

  if (!allow) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    reminder: ".env.local is local-only; Vercel needs Project → Settings → Environment Variables.",
    presence: getDbEnvPresenceReport()
  });
}
