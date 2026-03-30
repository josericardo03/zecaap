import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar senha | TourneyMaster",
};

export default function EsqueciSenhaPage() {
  return <ForgotPasswordForm />;
}
