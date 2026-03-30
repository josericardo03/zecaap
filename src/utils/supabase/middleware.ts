import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/** Resolve URL + chave pública (Edge/Vercel exige estar definido no projeto). */
function supabasePublicEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request,
  });

  const env = supabasePublicEnv();
  if (!env) {
    console.warn(
      "[middleware] Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY) na Vercel."
    );
    return supabaseResponse;
  }

  try {
    let response = supabaseResponse;

    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    await supabase.auth.getUser();
    return response;
  } catch (err) {
    console.error("[middleware] supabase.auth.getUser failed:", err);
    return supabaseResponse;
  }
}
