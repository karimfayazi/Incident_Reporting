import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { getSqlErrorDetails, getSqlPool, sql } from "@/lib/db";
import { normalizeUserRole, userRoles } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateUserSchema = z.object({
  password: z.string().max(255).optional(),
  fullName: z.string().trim().min(2, "Full name is required.").max(150),
  phone: z.string().trim().max(50).optional().default(""),
  role: z.enum(userRoles),
  isActive: z.boolean()
});

type RouteContext = {
  params: Promise<{ userId: string }>;
};

async function requireAdmin() {
  const user = await getUser();
  return user?.role === "admin" ? user : null;
}

async function getUserId(context: RouteContext) {
  const params = await context.params;
  const userId = Number(params.userId);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function normalizeUserRow<T extends { role?: unknown }>(row: T) {
  return {
    ...row,
    role: normalizeUserRole(row.role) ?? row.role
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = await getUserId(context);

  if (!userId) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid user data." }, { status: 400 });
  }

  const data = parsed.data;
  const password = data.password?.trim();

  try {
    const pool = await getSqlPool();
    const queryRequest = pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("FullName", sql.VarChar(150), data.fullName)
      .input("Phone", sql.VarChar(50), data.phone || null)
      .input("Role", sql.VarChar(50), data.role)
      .input("IsActive", sql.Bit, data.isActive);

    if (password) {
      queryRequest.input("Password", sql.VarChar(255), password);
    }

    const result = await queryRequest.query(`
      UPDATE [rifiiorg].[NC_RI_users]
      SET
        full_name = @FullName,
        phone = @Phone,
        role = @Role,
        is_active = @IsActive,
        ${password ? "password = @Password," : ""}
        updated_at = GETDATE()
      OUTPUT
        INSERTED.user_id,
        INSERTED.username,
        INSERTED.full_name,
        INSERTED.phone,
        INSERTED.role,
        CAST(INSERTED.is_active AS bit) AS is_active,
        INSERTED.created_at,
        INSERTED.updated_at
      WHERE user_id = @UserId;
    `);

    if (!result.recordset.length) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ user: normalizeUserRow(result.recordset[0]) });
  } catch (error) {
    console.error("Update user failed:", getSqlErrorDetails(error));
    return NextResponse.json({ error: "Unable to update user." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = await getUserId(context);

  if (!userId) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  try {
    const pool = await getSqlPool();
    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query(`
        UPDATE [rifiiorg].[NC_RI_users]
        SET is_active = 0, updated_at = GETDATE()
        OUTPUT INSERTED.user_id
        WHERE user_id = @UserId;
      `);

    if (!result.recordset.length) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Deactivate user failed:", getSqlErrorDetails(error));
    return NextResponse.json({ error: "Unable to deactivate user." }, { status: 500 });
  }
}
