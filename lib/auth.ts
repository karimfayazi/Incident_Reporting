import "server-only";

import { cookies } from "next/headers";
import { getSqlErrorDetails, getDbEnvPresenceReport, getSqlPool, sql } from "@/lib/db";
import {
  getRoleRedirect,
  normalizeUserRole,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  type SessionUser,
  signSessionToken,
  verifySessionToken
} from "@/lib/session";

type LoginInput = {
  username: string;
  password: string;
};

type LoginResult =
  | {
      ok: true;
      user: SessionUser;
      redirectTo: string;
      message: string;
      status: 200;
    }
  | {
      ok: false;
      error: string;
      status: 400 | 401 | 403 | 500 | 503;
      /** Populated for SQL / configuration failures so clients can show code + guidance. */
      diagnostics?: { code: string; message: string };
    };

type UserRow = {
  user_id: number;
  username: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | number | null;
};

function mapUser(row: UserRow): SessionUser | null {
  const role = normalizeUserRole(row.role);

  if (!role) {
    return null;
  }

  return {
    userId: Number(row.user_id),
    username: row.username,
    fullName: row.full_name || row.username,
    phone: row.phone || null,
    role
  };
}

const MISSING_DB_ENV_USER_MESSAGE =
  "Database configuration is missing on the deployed server. Please add environment variables in hosting settings and redeploy.";

const ESOCKET_USER_MESSAGE =
  "SQL Server network connection failed. Please verify TCP/IP, firewall, remote SQL access, and port 1433.";

function getLoginDatabaseError(error: unknown) {
  const details = getSqlErrorDetails(error);
  const connectionCodes = new Set(["ECONFIG", "ELOGIN", "ETIMEOUT", "ESOCKET"]);

  const isConnectionClass =
    connectionCodes.has(details.code) ||
    details.message.toLowerCase().includes("connection") ||
    details.message.toLowerCase().includes("database could not be opened");

  if (!isConnectionClass) {
    return { error: "Database query failed.", status: 500 as const, details };
  }

  if (details.code === "ECONFIG") {
    return {
      error: MISSING_DB_ENV_USER_MESSAGE,
      status: 503 as const,
      details: { ...details, message: MISSING_DB_ENV_USER_MESSAGE }
    };
  }

  if (details.code === "ESOCKET") {
    return {
      error: ESOCKET_USER_MESSAGE,
      status: 503 as const,
      details: { code: "ESOCKET", message: ESOCKET_USER_MESSAGE }
    };
  }

  return { error: "Database connection failed.", status: 503 as const, details };
}

export async function login({ username, password }: LoginInput): Promise<LoginResult> {
  const normalizedUsername = username.trim();

  if (!normalizedUsername || !password) {
    return { ok: false, error: "Username and password are required.", status: 400 };
  }

  try {
    const pool = await getSqlPool();
    const result = await pool
      .request()
      .input("Username", sql.VarChar(100), normalizedUsername)
      .input("Password", sql.VarChar(255), password)
      .query<UserRow>(`
        SELECT TOP (1)
          user_id,
          username,
          full_name,
          phone,
          role,
          is_active
        FROM [rifiiorg].[NC_RI_users]
        WHERE username = @Username
          AND password = @Password;
      `);

    const row = result.recordset[0];

    if (!row) {
      return { ok: false, error: "Invalid username or password.", status: 401 };
    }

    if (!row.is_active) {
      return { ok: false, error: "User is inactive.", status: 403 };
    }

    const user = mapUser(row);

    if (!user) {
      return { ok: false, error: "Your account role is not configured correctly.", status: 403 };
    }

    const token = await signSessionToken(user);
    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/"
    });

    return {
      ok: true,
      user,
      redirectTo: getRoleRedirect(user.role),
      message: "Login successful.",
      status: 200
    };
  } catch (error) {
    const databaseError = getLoginDatabaseError(error);
    if (databaseError.details.code === "ECONFIG") {
      console.error("Login failed: DB env incomplete (presence flags, no secrets):", getDbEnvPresenceReport());
    } else {
      console.error("Login failed:", databaseError.details);
    }
    return {
      ok: false,
      error: databaseError.error,
      status: databaseError.status,
      diagnostics:
        databaseError.details.code === "ECONFIG"
          ? undefined
          : { code: databaseError.details.code, message: databaseError.details.message }
    };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function getUser() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return {
    userId: session.userId,
    username: session.username,
    fullName: session.fullName,
    phone: session.phone,
    role: session.role
  } satisfies SessionUser;
}
