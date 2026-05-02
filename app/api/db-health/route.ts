import { NextResponse } from "next/server";

import {
  getDbEnvPresenceReport,
  getResolvedDbServer,
  getResolvedDbPort,
  getSqlErrorDetails,
  getSqlPool,
  testTcpConnection
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operators only — no secrets returned. Matches lib/db checklist for ESOCKET/firewall troubleshooting.
 */
const SERVER_SIDE_CHECKS: string[] = [
  "SQL Server Configuration Manager: enable TCP/IP, then restart the SQL Server service.",
  "SQL Server: enable remote connections; enable SQL Server Authentication (mixed mode); confirm the instance listens on TCP port 1433 (or set DB_PORT to your port).",
  "Firewall: allow inbound TCP 1433 (or your DB port) on the host; allow sqlservr.exe if required; verify cloud/hosting security groups.",
  "Vercel/serverless: outbound IPs are not fixed. If SQL Server only allows certain IPs, Vercel may be blocked — widen rules, terminate TLS nearer SQL, or use a backend with static egress.",
  "Health probe runs SELECT 1 AS ok only after env vars are present; passwords are never included in responses."
];

function buildPayload(input: {
  env: {
    hasServer: boolean;
    hasDatabase: boolean;
    hasUser: boolean;
    hasPassword: boolean;
    port: number;
  };
  tcpReachable: boolean;
  dbConnected: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}) {
  return {
    ...input,
    serverSideChecks: SERVER_SIDE_CHECKS
  };
}

/** Safe diagnostics — boolean flags and port only; never DB_PASSWORD or secrets */
export async function GET() {
  const presence = getDbEnvPresenceReport();
  const hasServer = presence.DB_SERVER || presence.DB_HOST;
  const hasDatabase = presence.DB_DATABASE || presence.DB_NAME;
  const hasUser = presence.DB_USER;
  const hasPassword = presence.DB_PASSWORD;
  const port = getResolvedDbPort();
  const server = getResolvedDbServer();

  const envLoaded = !!(
    hasServer &&
    hasDatabase &&
    hasUser &&
    hasPassword
  );

  if (!envLoaded) {
    return NextResponse.json(
      buildPayload({
        env: {
          hasServer,
          hasDatabase,
          hasUser,
          hasPassword,
          port
        },
        tcpReachable: false,
        dbConnected: false,
        errorCode: "ECONFIG",
        errorMessage:
          "Required database environment variables are missing. Set DB_SERVER or DB_HOST, DB_DATABASE or DB_NAME, DB_USER, DB_PASSWORD in hosting settings and redeploy."
      }),
      { status: 503 }
    );
  }

  const tcpReachable = await testTcpConnection(server!, port);

  if (!tcpReachable) {
    return NextResponse.json(
      buildPayload({
        env: {
          hasServer,
          hasDatabase,
          hasUser,
          hasPassword,
          port
        },
        tcpReachable: false,
        dbConnected: false,
        errorCode: "ESOCKET",
        errorMessage:
          "SQL Server is not reachable from the deployed server. Please check TCP/IP, firewall, public IP access, and port 1433."
      }),
      { status: 503 }
    );
  }

  try {
    const pool = await getSqlPool();
    await pool.request().query("SELECT 1 AS ok");
    return NextResponse.json(
      buildPayload({
        env: {
          hasServer,
          hasDatabase,
          hasUser,
          hasPassword,
          port
        },
        tcpReachable: true,
        dbConnected: true,
        errorCode: null,
        errorMessage: null
      }),
      { status: 200 }
    );
  } catch (error) {
    const details = getSqlErrorDetails(error);
    return NextResponse.json(
      buildPayload({
        env: {
          hasServer,
          hasDatabase,
          hasUser,
          hasPassword,
          port
        },
        tcpReachable: true,
        dbConnected: false,
        errorCode: details.code,
        errorMessage: details.message
      }),
      { status: 503 }
    );
  }
}
