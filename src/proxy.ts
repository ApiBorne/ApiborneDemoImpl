/**
 * Proxy Next 16 (ex-middleware) — deux protections indépendantes selon la route :
 *
 * 1. Routes du CONTRAT (/api/apiborneIntegrationService/*) : allowlist CORS.
 *    `DEMO_CORS_ORIGINS` (env) : liste d'origines borne autorisées, séparées par
 *    des virgules (ex. `https://kiosk.apiborne.com,https://ministaging.apiborne.com`).
 *    Vide/absente = ouvert à tous (`*`, défaut démo — comportement historique).
 *    Implémentation volontairement SANS toucher aux headers CORS des routes
 *    (cors.ts sert toujours `Access-Control-Allow-Origin: *`) : une origine hors
 *    liste est refusée ICI en 403 AVANT d'atteindre la route — plus fort qu'un
 *    simple refus CORS (le serveur ne répond pas), et aucun risque de headers
 *    `Access-Control-Allow-Origin` en double. Les requêtes SANS header Origin
 *    (curl, serveur ApiBorne, sondes) ne relèvent pas du CORS et passent toujours.
 *    Ces routes ne sont JAMAIS soumises au Basic auth ci-dessous — elles sont
 *    appelées par la borne et le serveur ApiBorne et ont leur propre
 *    authentification (staff/sign-in, en-têtes kiosk, chiffrement E2E).
 *
 * 2. Tout le reste (UI de démo + /api/demo/*) : protection d'accès de la démo
 *    déployée (tests end-to-end sur Render). Quand `DEMO_ACCESS_PASSWORD` est
 *    défini, exige une authentification HTTP Basic (login libre, mot de passe =
 *    la variable). Sans la variable — cas du développement local — AUCUN contrôle.
 */
import { NextRequest, NextResponse } from "next/server";

const REALM = "ApiBorne Demo";
const CONTRACT_PREFIX = "/api/apiborneIntegrationService/";

const ALLOWED_ORIGINS = (process.env.DEMO_CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter((origin) => origin !== "");

function contractCorsCheck(request: NextRequest): NextResponse {
  if (ALLOWED_ORIGINS.length === 0) {
    return NextResponse.next();
  }
  const origin = (request.headers.get("origin") ?? "").replace(/\/$/, "");
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.next();
  }
  return NextResponse.json(
    {
      error: {
        code: "ORIGIN_NOT_ALLOWED",
        message: `Origine « ${origin} » non autorisée (DEMO_CORS_ORIGINS)`,
        details: null,
      },
    },
    { status: 403 },
  );
}

function demoBasicAuthCheck(request: NextRequest): NextResponse {
  const password = process.env.DEMO_ACCESS_PASSWORD;

  // Pas de mot de passe configuré (local) → aucun contrôle.
  if (!password) {
    return NextResponse.next();
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice("Basic ".length));
      // "login:password" — le login n'est pas vérifié, seul le mot de passe l'est.
      const provided = decoded.slice(decoded.indexOf(":") + 1);
      if (provided === password) {
        return NextResponse.next();
      }
    } catch {
      // En-tête malformé → traité comme non authentifié.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"` },
  });
}

export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith(CONTRACT_PREFIX)) {
    return contractCorsCheck(request);
  }
  return demoBasicAuthCheck(request);
}

export const config = {
  // Tout SAUF les assets Next et le favicon ; le branchement contrat vs démo
  // se fait dans proxy() (les matchers doivent être statiques).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
