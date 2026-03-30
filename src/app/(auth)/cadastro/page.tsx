import type { Metadata } from "next";
import { CadastroForm } from "@/components/cadastro-form";

export const metadata: Metadata = {
  title: "Criar conta | TourneyMaster",
};

export default function CadastroPage() {
  return <CadastroForm />;
}
