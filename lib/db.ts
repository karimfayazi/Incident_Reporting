import sql from "mssql";

declare global {
  // Reuse the SQL pool across hot reloads in development.
  // eslint-disable-next-line no-var
  var sqlPoolPromise: Promise<sql.ConnectionPool> | undefined;
}

type SqlError = {
  code?: string;
  message?: string;
};

function trimEnv(value: string | undefined) {
  return typeof value === "string" ? value.trim() : value;
}

const isProduction = process.env.NODE_ENV === "production";

function resolveDbHost() {
  return trimEnv(process.env.DB_HOST) || trimEnv(process.env.DB_SERVER);
}

function resolveDbName() {
  return trimEnv(process.env.DB_NAME) || trimEnv(process.env.DB_DATABASE);
}

function resolveDbPort(): number {
  const raw = trimEnv(process.env.DB_PORT);
  const n = raw ? Number(raw) : 1433;
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    return 1433;
  }
  return n;
}

function buildSqlConfig(): sql.config {
  const server = resolveDbHost();
  const database = resolveDbName();
  const user = trimEnv(process.env.DB_USER);
  const password = trimEnv(process.env.DB_PASSWORD);
  const port = resolveDbPort();

  const prodTrustExplicit = trimEnv(process.env.DB_TRUST_SERVER_CERTIFICATE) === "true";

  const productionOptions = {
    encrypt: true,
    trustServerCertificate: prodTrustExplicit,
    enableArithAbort: true,
    connectTimeout: 30_000,
    requestTimeout: 30_000
  };

  const developmentOptions = {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    enableArithAbort: true,
    connectTimeout: 30_000,
    requestTimeout: 30_000
  };

  return {
    server: server!,
    database: database!,
    user: user!,
    password: password!,
    port,
    options: isProduction ? productionOptions : developmentOptions,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
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
        "SQL Server connection timed out. Verify network access, firewall (allow Vercel egress / your IP), port, and connectTimeout."
    };
  }

  if (code === "ESOCKET" || message.toLowerCase().includes("failed to connect")) {
    return {
      code,
      message:
        "SQL Server network connection failed. Verify DB_HOST (or DB_SERVER), TCP/IP enabled on SQL Server, firewall rules (host + cloud), and that the port is reachable from Vercel."
    };
  }

  if (message.toLowerCase().includes("database") && message.toLowerCase().includes("cannot open")) {
    return {
      code,
      message:
        "SQL Server database could not be opened. Verify DB_NAME (or DB_DATABASE) and user permissions."
    };
  }

  if (message.toLowerCase().includes("certificate") || message.toLowerCase().includes("encrypt")) {
    return {
      code,
      message:
        "SQL Server TLS failed. Production uses encrypt=true. Self-signed certs: set DB_TRUST_SERVER_CERTIFICATE=true on Vercel, or install a publicly trusted TLS cert on SQL Server."
    };
  }

  if (message.toLowerCase().includes("missing required database environment variables")) {
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

function assertDbEnvPresent() {
  const server = resolveDbHost();
  const database = resolveDbName();
  const user = trimEnv(process.env.DB_USER);
  const password = trimEnv(process.env.DB_PASSWORD);

  const missing: string[] = [];
  if (!server) missing.push("DB_HOST or DB_SERVER");
  if (!database) missing.push("DB_NAME or DB_DATABASE");
  if (!user) missing.push("DB_USER");
  if (!password) missing.push("DB_PASSWORD");

  if (missing.length > 0) {
    throw new Error(
      `Missing required database environment variables (${missing.join(
        ", "
      )}). Add them in your host settings (for Vercel: Project → Settings → Environment Variables) and redeploy so serverless bundles pick them up.`
    );
  }
}

export async function getSqlPool() {
  assertDbEnvPresent();

  if (!global.sqlPoolPromise) {
    const pool = new sql.ConnectionPool(buildSqlConfig());

    global.sqlPoolPromise = pool.connect().catch((error) => {
      global.sqlPoolPromise = undefined;
      throw error;
    });
  }

  return global.sqlPoolPromise;
}

export { sql };
