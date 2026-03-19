import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("aura-session")?.value;

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Read role from a lightweight cookie set during login.
  // This avoids an internal fetch to /api/auth/verify which deadlocks
  // the Next.js dev server (single-threaded, can't serve the verify
  // request while the middleware request is still in-flight).
  const role = request.cookies.get("aura-role")?.value;
  const path = request.nextUrl.pathname;

  if (role) {
    if (path.startsWith("/agent") && role === "admin") {
      return NextResponse.redirect(new URL("/company/dashboard", request.url));
    }

    if (path.startsWith("/company") && role === "agent") {
      return NextResponse.redirect(new URL("/agent/dashboard", request.url));
    }
  }

  // Session exists → allow through. Deep auth verification happens
  // in the page layouts (AgentLayout / CompanyLayout) via useAuth().
  return NextResponse.next();
}

export const config = {
  matcher: ["/company/:path*", "/agent/:path*"],
};
