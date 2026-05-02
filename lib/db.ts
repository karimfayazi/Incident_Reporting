import sql from "mssql";

/**
 * Server-only secrets: never NEXT_PUBLIC_*.
 * .env.local applies locally only; production needs host env vars (e.g. Vercel Dashboard).
 *
 * Server-side checklist when ESOCKET / unreachable from the host (e.g. Vercel):
 * - SQL Server Configuration Manager: enable TCP/IP; restart the SQL Server service.
 * - SQL Server: allow remote connections; SQL Server Authentication; confirm TCP port (default 1433).
 * - Firewall (OS + cloud): allow inbound TCP on the SQL port; allow sqlservr.exe if needed.
 * - Vercel/serverless: outbound IPs are not fixed—IP allowlists on the SQL side often block; use wider rules,
 *   an API hosted near SQL, or a backend with static egress.
 */

type SqlError = {
  code?: string;
  message?: string;
};

function trimEnv(value: string | undefined) {
  return typeof value === "string" ? value.trim() : value;
}

/** Reusable pooled connection for Node serverless warm instances */
let poolPromise: Promise<sql.ConnectionPool> | null = null;

function resolveServer() {
  return trimEnv(process.env.DB_SERVER) || trimEnv(process.env.DB_HOST);
}

function resolveDatabase() {
  return trimEnv(process.env.DB_DATABASE) || trimEnv(process.env.DB_NAME);
}

function resolvePassword() {
  return trimEnv(process.env.DB_PASSWORD);
}

export function getResolvedDbPort(): number {
  const port = Number(process.env.DB_PORT || 1433);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return 1433;
  }
  return port;
}

function buildSqlConfig(): sql.config {
  const serverRaw = trimEnv(process.env.DB_SERVER) || trimEnv(process.env.DB_HOST);
  const databaseRaw = trimEnv(process.env.DB_DATABASE) || trimEnv(process.env.DB_NAME);
  const user = trimEnv(process.env.DB_USER);
  const password = resolvePassword();

  const server = serverRaw || "";
  const database = databaseRaw || "";

  if (!server || !database || !user || !password) {
    console.warn("[Incident Reporting][db] Incomplete DB env — check Vercel Environment Variables.");
    throw new Error(
      "Missing required database environment variables. Required: DB_SERVER or DB_HOST, DB_DATABASE or DB_NAME, DB_USER, DB_PASSWORD."
    );
  }

  const portSafe = getResolvedDbPort();

  const encrypt =
    String(process.env.DB_ENCRYPT || "false").toLowerCase() === "true";

  const config: sql.config = {
    server,
    database,
    user,
    password,
    port: portSafe,
    options: {
      encrypt,
      trustServerCertificate: true,
      enableArithAbort: true
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    connectionTimeout: 30000,
    requestTimeout: 30000
  };

  return config;
}

export async function getDbPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(buildSqlConfig()).catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

/** @deprecated Alias — use `getDbPool`; kept so existing handlers stay unchanged */
export async function getSqlPool() {
  return getDbPool();
}

export type DbEnvPresenceReport = Record<
  "DB_SERVER" | "DB_HOST" | "DB_DATABASE" | "DB_NAME" | "DB_USER" | "DB_PASSWORD" | "DB_PORT" | "DB_ENCRYPT",
  boolean
>;

/** True iff each named variable is present and non-empty after trim — never exposes values */
export function getDbEnvPresenceReport(): DbEnvPresenceReport {
  const has = (key: string) =>
    typeof process.env[key] === "string" &&
    (trimEnv(process.env[key])?.length ?? 0) > 0;

  return {
    DB_SERVER: has("DB_SERVER"),
    DB_HOST: has("DB_HOST"),
    DB_DATABASE: has("DB_DATABASE"),
    DB_NAME: has("DB_NAME"),
    DB_USER: has("DB_USER"),
    DB_PASSWORD: has("DB_PASSWORD"),
    DB_PORT: has("DB_PORT"),
    DB_ENCRYPT: has("DB_ENCRYPT")
  };
}

export function getSqlErrorDetails(error: unknown) {
  const sqlError = error as SqlError;
  const code = sqlError?.code ?? "UNKNOWN";
  const message = sqlError?.message ?? "Unknown SQL Server error.";

  if (code === "ELOGIN" || message.toLowerCase().includes("login failed")) {
    return {
      code,
      message: "SQL Server login failed. Verify DB_USER and DB_PASSWORD in environment variables."
    };
  }

  if (code === "ETIMEOUT" || message.toLowerCase().includes("timeout")) {
    return {
      code,
      message:
        "SQL Server connection timed out. Verify network access, firewall, port 1433, and connection timeout."
    };
  }

  if (
    code === "ESOCKET" ||
    message.toLowerCase().includes("failed to connect")
  ) {
    return {
      code: "ESOCKET",
      message:
        "SQL Server is not reachable from the deployed server. Please check TCP/IP, firewall, public IP access, and port 1433."
    };
  }

  if (
    message.toLowerCase().includes("database") &&
    message.toLowerCase().includes("cannot open")
  ) {
    return {
      code,
      message:
        "SQL Server database could not be opened. Verify DB_DATABASE or DB_NAME and user permissions."
    };
  }

  if (
    message.toLowerCase().includes("certificate") ||
    message.toLowerCase().includes("encrypt")
  ) {
    return {
      code,
      message:
        "SQL Server TLS failed. Adjust DB_ENCRYPT or server certificate settings."
    };
  }

  if (
    message
      .toLowerCase()
      .includes("missing required database environment variables")
  ) {
    return {
      code: "ECONFIG",
      message
    };
  }

  return {
    code,
    message: "SQL Server request failed. Check server logs for details."
  };
}

export { sql };
