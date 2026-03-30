import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Nova senha | TourneyMaster",
};

export default function RedefinirSenhaPage() {
  return <ResetPasswordForm />;
}
