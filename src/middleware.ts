/**
 * Protection d'accès de la demo déployée (tests end-to-end sur Render).
 *
 * Quand `DEMO_ACCESS_PASSWORD` est défini, l'UI de démo et ses routes internes
 * (/api/demo/*) exigent une authentification HTTP Basic (login libre, mot de
 * passe = la variable). Sans la variable — cas du développement local — AUCUN
 * contrôle n'est appliqué.
 *
 * IMPORTANT : les routes du CONTRAT (/api/apiborneIntegrationService/*) ne sont
 * JAMAIS protégées ici — elles sont appelées par la borne et le serveur
 * ApiBorne et disposent de leur propre authentification (staff/sign-in, en-têtes
 * kiosk, chiffrement de bout en bout). Les gater casserait l'intégration.
 */
import { NextRequest, NextResponse } from "next/server";

const REALM = "ApiBorne Demo";

export function middleware(request: NextRequest): NextResponse {
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

export const config = {
  // On protège tout SAUF : les routes du contrat (appelées par la borne/serveur),
  // les assets Next et le favicon.
  matcher: ["/((?!api/apiborneIntegrationService|_next/static|_next/image|favicon.ico).*)"],
};
