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

const dbConfig = {
  server: trimEnv(process.env.DB_SERVER),
  database: trimEnv(process.env.DB_DATABASE || process.env.DB_NAME),
  user: trimEnv(process.env.DB_USER),
  password: trimEnv(process.env.DB_PASSWORD),
  port: Number(trimEnv(process.env.DB_PORT) || 1433),
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true"
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

export function getSqlErrorDetails(error: unknown) {
  const sqlError = error as SqlError;
  const code = sqlError?.code ?? "UNKNOWN";
  const message = sqlError?.message ?? "Unknown SQL Server error.";

  if (code === "ELOGIN" || message.toLowerCase().includes("login failed")) {
    return {
      code,
      message: "SQL Server login failed. Verify DB_USER and DB_PASSWORD in .env.local."
    };
  }

  if (code === "ETIMEOUT" || message.toLowerCase().includes("timeout")) {
    return {
      code,
      message: "SQL Server connection timed out. Verify network access, firewall, port 1433, and Connect Timeout."
    };
  }

  if (code === "ESOCKET" || message.toLowerCase().includes("failed to connect")) {
    return {
      code,
      message: "SQL Server network connection failed. Verify server IP, firewall rules, and TCP/IP access."
    };
  }

  if (message.toLowerCase().includes("database") && message.toLowerCase().includes("cannot open")) {
    return {
      code,
      message: "SQL Server database could not be opened. Verify DB_DATABASE and user permissions."
    };
  }

  if (message.toLowerCase().includes("certificate") || message.toLowerCase().includes("encrypt")) {
    return {
      code,
      message: "SQL Server encryption or certificate validation failed. Verify DB_ENCRYPT and DB_TRUST_SERVER_CERTIFICATE."
    };
  }

  if (message.toLowerCase().includes("missing required database environment variables")) {
    return {
      code: "ECONFIG",
      message: "Missing required database environment variables."
    };
  }

  return {
    code,
    message: "SQL Server request failed. Check server logs for details."
  };
}

export async function getSqlPool() {
  if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_DATABASE) {
    throw new Error("Missing required database environment variables");
  }

  if (!global.sqlPoolPromise) {
    const pool = new sql.ConnectionPool(dbConfig as sql.config);

    global.sqlPoolPromise = pool.connect().catch((error) => {
      global.sqlPoolPromise = undefined;
      throw error;
    });
  }

  return global.sqlPoolPromise;
}

export { sql };
