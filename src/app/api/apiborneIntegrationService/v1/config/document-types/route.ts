/**
 * GET /config/document-types — operationId `getConfigDocumentTypes`
 * (configuration route, auth-key-only — appelée par le serveur ApiBorne).
 *
 * LE RÉFÉRENTIEL DES TYPES DE DOCUMENTS APPARTIENT À L'ÉDITEUR : cette route
 * expose la liste qui fait foi pour les documents requis
 * (`requiredDocumentTypes`) et les uploads (`documentType`). Les codes
 * reprennent le vocabulaire standard du contrat quand il correspond
 * (contract/document-types.md) ; les codes propres à l'éditeur sont permis.
 * Éditable dans la page /referentials de la démo.
 *
 * Le référentiel ne sert qu'à CONSTRUIRE la liste : libellé personnalisé et
 * « fournissable depuis le téléphone » se paramètrent dans l'admin ApiBorne
 * (page Paramètres des documents requis), pas ici.
 */
import type { NextRequest } from "next/server";
import { requireAuthKey } from "@/server/contract/auth";
import { ok, withErrorBoundary } from "@/server/contract/errors";
import { listDocumentTypes } from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const GET = withErrorBoundary(async (request: NextRequest) => {
  const authError = requireAuthKey(request);
  if (authError) return authError;

  return ok({
    documentTypes: listDocumentTypes().map((type) => ({
      documentType: type.code,
      label: type.label,
    })),
  });
});
