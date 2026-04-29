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

  if (message.toLowerCase().includes("environment variables are not configured")) {
    return {
      code: "ECONFIG",
      message: "SQL Server environment variables are not configured. Set SQLSERVER_CONNECTION_STRING or DB_SERVER, DB_DATABASE (or DB_NAME), DB_USER, and DB_PASSWORD."
    };
  }

  return {
    code,
    message: "SQL Server request failed. Check server logs for details."
  };
}

function trimEnv(value: string | undefined) {
  return typeof value === "string" ? value.trim() : value;
}

export async function getSqlPool() {
  const connectionString = trimEnv(process.env.SQLSERVER_CONNECTION_STRING);
  const server = trimEnv(process.env.DB_SERVER);
  const database = trimEnv(process.env.DB_DATABASE ?? process.env.DB_NAME);
  const user = trimEnv(process.env.DB_USER);
  const password = trimEnv(process.env.DB_PASSWORD);
  const portRaw = trimEnv(process.env.DB_PORT) ?? "1433";
  const port = Number(portRaw) || 1433;
  const encrypt = process.env.DB_ENCRYPT === "true";
  const trustServerCertificate = process.env.DB_TRUST_SERVER_CERTIFICATE === "true";

  if (!connectionString && (!server || !database || !user || !password)) {
    throw new Error("SQL Server environment variables are not configured.");
  }

  if (!global.sqlPoolPromise) {
    const pool = connectionString
      ? new sql.ConnectionPool(connectionString)
      : new sql.ConnectionPool({
          server: server as string,
          database: database as string,
          user: user as string,
          password: password as string,
          port,
          options: {
            encrypt,
            trustServerCertificate,
            enableArithAbort: true
          },
          pool: {
            max: 300,
            min: 0,
            idleTimeoutMillis: 30000
          },
          connectionTimeout: 60000,
          requestTimeout: 60000
        });

    global.sqlPoolPromise = pool.connect().catch((error) => {
      global.sqlPoolPromise = undefined;
      throw error;
    });
  }

  return global.sqlPoolPromise;
}

export { sql };
