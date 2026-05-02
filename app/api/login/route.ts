import { NextResponse } from "next/server";
import { z } from "zod";
import { login } from "@/lib/auth";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid login request.";
      return NextResponse.json({ success: false, message, user: null }, { status: 400 });
    }

    const result = await login({
      username: parsed.data.username,
      password: parsed.data.password
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          message: result.error,
          user: null
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      user: result.user,
      redirectTo: result.redirectTo
    });
  } catch (error) {
    console.error("/api/login failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Login request failed.",
        user: null
      },
      { status: 500 }
    );
  }
}
