import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export type SessionProfile = {
  user: { id: string; email?: string };
  profile: {
    id: string;
    nickname: string;
    avatar_url: string | null;
  } | null;
};

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user: { id: user.id, email: user.email },
    profile: profile ?? null,
  };
}
