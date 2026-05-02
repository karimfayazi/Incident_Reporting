import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { getSqlErrorDetails, getSqlPool, sql } from "@/lib/db";
import { normalizeUserRole, userRoles } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createUserSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters.").max(100),
  password: z.string().min(3, "Password must be at least 3 characters.").max(255),
  fullName: z.string().trim().min(2, "Full name is required.").max(150),
  phone: z.string().trim().max(50).optional().default(""),
  role: z.enum(userRoles),
  isActive: z.boolean().default(true)
});

async function requireAdmin() {
  const user = await getUser();
  return user?.role === "admin" ? user : null;
}

function normalizeUserRows<T extends { role?: unknown }>(rows: T[]) {
  return rows.map((row) => ({
    ...row,
    role: normalizeUserRole(row.role) ?? row.role
  }));
}

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const username = url.searchParams.get("username")?.trim() ?? "";
    const role = url.searchParams.get("role")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";
    const where = ["1 = 1"];
    const pool = await getSqlPool();
    const queryRequest = pool.request();

    if (username) {
      where.push("(username LIKE @Username OR full_name LIKE @Username)");
      queryRequest.input("Username", sql.VarChar(120), `%${username}%`);
    }

    if (userRoles.includes(role as (typeof userRoles)[number])) {
      where.push("role = @Role");
      queryRequest.input("Role", sql.VarChar(50), role);
    }

    if (status === "active" || status === "inactive") {
      where.push("is_active = @IsActive");
      queryRequest.input("IsActive", sql.Bit, status === "active");
    }

    const result = await queryRequest.query(`
      SELECT
        user_id,
        username,
        full_name,
        phone,
        role,
        CAST(is_active AS bit) AS is_active,
        created_at,
        updated_at
      FROM [rifiiorg].[NC_RI_users]
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC, user_id DESC;
    `);

    return NextResponse.json({ users: normalizeUserRows(result.recordset) });
  } catch (error) {
    console.error("User list failed:", getSqlErrorDetails(error));
    return NextResponse.json({ error: "Unable to load users." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid user data." }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const pool = await getSqlPool();
    const duplicate = await pool
      .request()
      .input("Username", sql.VarChar(100), data.username)
      .query("SELECT TOP (1) user_id FROM [rifiiorg].[NC_RI_users] WHERE username = @Username;");

    if (duplicate.recordset.length) {
      return NextResponse.json({ error: "Username already exists." }, { status: 409 });
    }

    const result = await pool
      .request()
      .input("Username", sql.VarChar(100), data.username)
      .input("Password", sql.VarChar(255), data.password)
      .input("FullName", sql.VarChar(150), data.fullName)
      .input("Phone", sql.VarChar(50), data.phone || null)
      .input("Role", sql.VarChar(50), data.role)
      .input("IsActive", sql.Bit, data.isActive)
      .query(`
        INSERT INTO [rifiiorg].[NC_RI_users] (
          username,
          password,
          full_name,
          phone,
          role,
          is_active,
          created_at,
          updated_at
        )
        OUTPUT
          INSERTED.user_id,
          INSERTED.username,
          INSERTED.full_name,
          INSERTED.phone,
          INSERTED.role,
          CAST(INSERTED.is_active AS bit) AS is_active,
          INSERTED.created_at,
          INSERTED.updated_at
        VALUES (
          @Username,
          @Password,
          @FullName,
          @Phone,
          @Role,
          @IsActive,
          GETDATE(),
          GETDATE()
        );
      `);

    return NextResponse.json({ user: normalizeUserRows(result.recordset)[0] }, { status: 201 });
  } catch (error) {
    console.error("Create user failed:", getSqlErrorDetails(error));
    return NextResponse.json({ error: "Unable to create user." }, { status: 500 });
  }
}
