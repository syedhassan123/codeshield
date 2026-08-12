import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/types/user";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      avatar?: string;
      otpVerified: boolean;
      faceVerified: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    avatar?: string;
    otpVerified?: boolean;
    faceVerified?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    avatar?: string;
    otpVerified: boolean;
    faceVerified: boolean;
    /** ms timestamp when this login JWT was created (stable across session.update) */
    authTime?: number;
  }
}
