import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, homeForRole } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const publicPaths = ["/", "/forgot-password"];
const authFlowPaths = ["/verify-otp", "/verify-face"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = Boolean(session?.user);
  const otpVerified = Boolean(session?.user?.otpVerified);
  const faceVerified = Boolean(session?.user?.faceVerified);
  const fullyVerified = otpVerified && faceVerified;
  const role = session?.user?.role;

  const isPublic = publicPaths.includes(pathname);
  const isAuthFlow = authFlowPaths.includes(pathname);
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

  if (!fullyVerified) {
    if (isAuthFlow) {
      return NextResponse.next();
    }
    const target = !otpVerified ? "/verify-otp" : "/verify-face";
    return NextResponse.redirect(new URL(target, req.nextUrl.origin));
  }

  if (isPublic || isAuthFlow) {
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

  // Prototype student "Join" links point at /interviewer/lobby/* — allow students there.
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
