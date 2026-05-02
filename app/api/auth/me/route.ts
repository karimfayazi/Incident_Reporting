import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
