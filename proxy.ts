import { NextResponse, type NextRequest } from "next/server";
import { getRoleRedirect, SESSION_COOKIE_NAME, type UserRole, verifySessionToken } from "@/lib/session";

const protectedRoutes: Array<{
  prefix: string;
  roles: UserRole[];
}> = [
  { prefix: "/record-incident", roles: ["field_volunteer"] },
  { prefix: "/dashboard", roles: ["ntf_volunteer", "admin"] },
  { prefix: "/export-data", roles: ["admin"] },
  { prefix: "/admin", roles: ["admin"] }
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rule = protectedRoutes.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`));

  if (!rule) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!rule.roles.includes(session.role)) {
    return NextResponse.redirect(new URL(getRoleRedirect(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/record-incident/:path*", "/dashboard/:path*", "/export-data/:path*", "/admin/:path*"]
};
