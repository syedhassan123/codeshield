import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, homeForRole } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const publicPaths = ["/", "/forgot-password"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = Boolean(session?.user);
  const otpVerified = Boolean(session?.user?.otpVerified);
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

  // Production auth gate: Email/password session + OTP only (face optional).
  if (!otpVerified) {
    if (pathname === "/verify-otp") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/verify-otp", req.nextUrl.origin));
  }

  // OTP done → leave public/auth-flow pages for the role dashboard.
  // Allow optional /verify-face without blocking dashboard access.
  if (isPublic || pathname === "/verify-otp") {
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
