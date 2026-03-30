import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-url-pathname") ?? "";
  const isPasswordResetPage =
    pathname === "/redefinir-senha" || pathname.startsWith("/redefinir-senha/");

  const session = await getSessionProfile();
  if (session && !isPasswordResetPage) redirect("/");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1a1f35_0%,_#0b0e1b_55%)] px-4 py-12">
      {children}
    </div>
  );
}
