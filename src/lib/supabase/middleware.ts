import { authBypassEnabled } from "@/lib/auth-mode";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/** Las cookies que Supabase actualiza en `supabaseResponse` deben copiarse al redirect; si no, el layout del servidor no ve la sesión y se produce bucle login ↔ dashboard. */
function redirectToPathWithCookies(
  request: NextRequest,
  pathname: string,
  supabaseResponse: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirect = NextResponse.redirect(url);
  for (const cookie of supabaseResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

function redirectToLoginBare(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

async function updateSessionInner(request: NextRequest): Promise<NextResponse> {
  if (authBypassEnabled()) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnon) {
    console.error(
      "[middleware] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY; no se puede validar la sesión.",
    );
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      return redirectToLoginBare(request);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
      return redirectToPathWithCookies(request, "/login", supabaseResponse);
    }

    // No redirigir aquí /login → /dashboard: usar la página de login (Server Component)
    // con las mismas cookies que `createClient()` del servidor, para evitar bucles.

    return supabaseResponse;
  } catch (e) {
    console.error("[middleware] updateSession falló:", e);
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      return redirectToPathWithCookies(request, "/login", supabaseResponse);
    }
    return NextResponse.next({ request });
  }
}

export async function updateSession(request: NextRequest) {
  return updateSessionInner(request);
}
