import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, homeForRole } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

/** Public surfaces (no Auth.js session required). */
const publicPaths = ["/", "/forgot-password", "/verify-otp"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = Boolean(session?.user);
  const role = session?.user?.role;

  const isPublic = publicPaths.includes(pathname);
  const isApiAuth = pathname.startsWith("/api/auth");

  if (isApiAuth) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (isPublic) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  // Authenticated: leave landing / registration OTP / forgot-password for role home.
  // Face verification is optional and must not block dashboard access.
  if (
    pathname === "/" ||
    pathname === "/forgot-password" ||
    pathname === "/verify-otp"
  ) {
    return NextResponse.redirect(
      new URL(homeForRole(role!), req.nextUrl.origin),
    );
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(
      new URL(homeForRole(role!), req.nextUrl.origin),
    );
  }

  if (pathname.startsWith("/student") && role !== "student") {
    return NextResponse.redirect(
      new URL(homeForRole(role!), req.nextUrl.origin),
    );
  }

  const sharedInterviewSurface =
    pathname.startsWith("/interviewer/lobby/") ||
    pathname.startsWith("/interviewer/room/");

  if (
    pathname.startsWith("/interviewer") &&
    role !== "interviewer" &&
    !(role === "student" && sharedInterviewSurface)
  ) {
    return NextResponse.redirect(
      new URL(homeForRole(role!), req.nextUrl.origin),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
