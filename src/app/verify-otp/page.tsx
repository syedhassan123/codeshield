import { redirect } from "next/navigation";
import { VerifyOtpClient } from "@/components/auth/verify-otp-client";

type SearchParams = {
  email?: string;
  purpose?: string;
  registered?: string;
};

/** Registration email verification only — login no longer uses OTP. */
export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const email = params.email?.trim() || null;

  if (!email) {
    redirect("/");
  }

  return (
    <VerifyOtpClient
      email={email}
      justRegistered={params.registered === "1"}
    />
  );
}
