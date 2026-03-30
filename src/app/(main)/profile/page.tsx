import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { ProfileForm } from "@/components/profile-form";

export async function generateMetadata() {
  return { title: "Perfil | TourneyMaster" };
}

export default async function ProfilePage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-xl font-bold text-white">Perfil</h1>
      <p className="text-sm text-tm-muted">
        Atualize o nickname e o avatar. Os arquivos são salvos no bucket{" "}
        <code className="text-tm-cyan">avatars</code>.
      </p>
      <ProfileForm
        userId={session.user.id}
        initialNickname={session.profile?.nickname ?? ""}
        initialAvatarUrl={session.profile?.avatar_url ?? null}
      />
    </div>
  );
}
