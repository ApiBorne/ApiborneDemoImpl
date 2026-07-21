/**
 * VOCABULAIRE STANDARD des `documentType` du contrat (43 codes,
 * contract/document-types.md) avec leurs libellés français par défaut.
 *
 * Sert UNIQUEMENT de graine au référentiel `document_types` (seed.ts) : le
 * référentiel vivant appartient à l'éditeur — table éditable dans
 * /referentials, servie par GET /config/document-types, consommée par le
 * dialog Documents et les routes du contrat. Ne pas consommer cette liste
 * directement ailleurs.
 */

export interface DocumentTypeDef {
  documentType: string;
  label: string;
}

export const DOCUMENT_TYPES: DocumentTypeDef[] = [
  { documentType: "prescription", label: "Ordonnance" },
  { documentType: "bloodTest", label: "Analyse sanguine" },
  { documentType: "careSheet", label: "Feuille de soin" },
  { documentType: "medicalReport", label: "Compte rendu" },
  { documentType: "questionnaire", label: "Questionnaire" },
  { documentType: "convocation", label: "Convocation" },
  { documentType: "other", label: "Autre" },
  { documentType: "mutualInsuranceCard", label: "Carte Mutuelle" },
  { documentType: "workAccidentCertificate", label: "Attestation Accident Travail" },
  { documentType: "occupationalDiseaseCertificate", label: "Attestation Maladie professionnelle" },
  { documentType: "cssRightsCertificate", label: "Attestation de droits CSS" },
  { documentType: "urineTest", label: "Analyse d'urine" },
  { documentType: "signedConsent", label: "Consentement signé" },
  { documentType: "cardiologistLetter", label: "Lettre cardiologue" },
  { documentType: "bhcgResults", label: "Résultats BHCG" },
  { documentType: "coagulationResults", label: "Résultats coag" },
  { documentType: "creatinineResults", label: "Résultats créatinémie" },
  { documentType: "calciumResults", label: "Résultats calcémie" },
  { documentType: "psaResults", label: "Résultats PSA" },
  { documentType: "t21ScreeningResults", label: "Résultats dépistage combiné T21" },
  { documentType: "implantCard", label: "Carte DMI" },
  { documentType: "hospitalizationForm", label: "Bon hospi" },
  { documentType: "careAuthorization", label: "Autorisation soins mineurs / majeurs protégés" },
  { documentType: "implantCompatibilityForm", label: "Fiche compatibilité DMI" },
  { documentType: "implantSurgeryReport", label: "CR opératoire pose DMI" },
  { documentType: "mriQuestionnaire", label: "Questionnaire IRM" },
  { documentType: "kneeQuestionnaire", label: "Questionnaire genou" },
  { documentType: "endometriosisQuestionnaire", label: "Questionnaire endométriose" },
  { documentType: "ctScanQuestionnaire", label: "Questionnaire scanner" },
  { documentType: "spineQuestionnaire", label: "Questionnaire rachis" },
  { documentType: "shoulderQuestionnaire", label: "Questionnaire épaule" },
  { documentType: "boneDensitometryQuestionnaire", label: "Questionnaire Ostéodensitométrie" },
  { documentType: "pediatricExamFollowUpForm", label: "Fiche de suivi examen pédiatrique" },
  { documentType: "quote", label: "Devis" },
  { documentType: "staffReviewForm", label: "Fiche retour de Staff" },
  { documentType: "pathologyResults", label: "Résultats Anapath" },
  { documentType: "mammographyQuestionnaire", label: "Questionnaire Mammo" },
  { documentType: "skullQuestionnaire", label: "Questionnaire Crâne" },
  { documentType: "pelvicUltrasoundReport", label: "Compte Rendu Échographie Pelvienne" },
  { documentType: "lumbarMriReport", label: "Compte rendu IRM lombaire de moins de 6 mois" },
  { documentType: "cervicalMriReport", label: "Compte rendu IRM cervical de moins de 3 mois" },
];

const LABEL_BY_TYPE = new Map(DOCUMENT_TYPES.map((d) => [d.documentType, d.label]));

/** Displayable label of a documentType — the type itself for unknown values. */
export function documentTypeLabel(documentType: string): string {
  return LABEL_BY_TYPE.get(documentType) ?? documentType;
}
