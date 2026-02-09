import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

function getSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  const projectRef = getSupabaseProjectRef();
  const primaryCookie = projectRef ? `sb-${projectRef}-auth-token` : null;
  return request.cookies.getAll().some((cookie) => {
    if (primaryCookie && cookie.name === primaryCookie) return true;
    return cookie.name.startsWith("sb-") && cookie.name.includes("auth-token");
  });
}

function isProtectedPath(pathname: string): boolean {
  return (
    /^\/(en|zh)\/admin(\/|$)/.test(pathname) ||
    /^\/(en|zh)\/settings(\/|$)/.test(pathname) ||
    /^\/admin(\/|$)/.test(pathname) ||
    /^\/settings(\/|$)/.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const shouldRefreshSession =
    hasSupabaseAuthCookie(request) || isProtectedPath(pathname);

  if (!shouldRefreshSession) {
    return intlMiddleware(request);
  }

  // Refresh Supabase session only when needed
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  await supabase.auth.getUser();

  const intlResponse = intlMiddleware(request);
  response.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
