import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

function withPathnameHeader(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-url-pathname", request.nextUrl.pathname);
  return new NextRequest(request.url, { headers: requestHeaders });
}

export async function middleware(request: NextRequest) {
  const requestWithPath = withPathnameHeader(request);
  try {
    return await updateSession(requestWithPath);
  } catch (err) {
    console.error("[middleware]", err);
    return NextResponse.next({
      request: { headers: requestWithPath.headers },
    });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
