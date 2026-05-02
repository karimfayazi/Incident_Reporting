import { NextResponse } from "next/server";
import { z } from "zod";
import { login } from "@/lib/auth";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required.")
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid login request." }, { status: 400 });
  }

  const result = await login(parsed.data);

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.error, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    user: result.user,
    redirectTo: result.redirectTo
  });
}
