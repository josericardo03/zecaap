import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  return <AppShell session={session}>{children}</AppShell>;
}
