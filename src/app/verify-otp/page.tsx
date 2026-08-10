import { auth } from "@/lib/auth";
import { VerifyOtpClient } from "@/components/auth/verify-otp-client";

export default async function VerifyOtpPage() {
  const session = await auth();
  return <VerifyOtpClient email={session?.user?.email} />;
}
