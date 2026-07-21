# documentType — enum du contrat et correspondance EasyDoct

Le contrat véhicule les types de documents sous forme d'**enum string vendor-neutral**
(`DocumentType` dans `openapi.yaml`). Cette page fixe la correspondance avec l'enum
entier `EasyDoct.Bom.AppointmentFileType` (réf. côté serveur ApiBorne :
`server/src/kiosk-config/appointment-file-type.constants.ts`).

Règles :

- La conversion string ↔ int se fait **uniquement dans les mappers** (contrôleur
  EasyDoct `KioskIntegrationController` côté serveur, `contractBackend` côté borne).
  Aucune valeur entière EasyDoct ne transite sur le contrat.
- Un éditeur tiers qui ne gère pas un type le traite comme `other`.
- Une valeur entière EasyDoct sans correspondance (types `Unknown`/`Other`, ou valeur
  future) est mappée sur `other` ; en sens inverse, `other` est mappé sur le type
  EasyDoct `Other` (7).
- Les libellés ci-dessous sont les libellés français par défaut d'EasyDoct
  (`ToDisplay`) ; le contrat transmet le libellé effectif dans `label`, l'enum ne
  sert qu'à la logique (documents manquants, remplacement).

| documentType (contrat) | AppointmentFileType (EasyDoct) | Libellé par défaut |
|---|---:|---|
| `prescription` | 1 | Ordonnance |
| `bloodTest` | 2 | Analyse sanguine |
| `careSheet` | 3 | Feuille de soin |
| `medicalReport` | 4 | Compte rendu |
| `questionnaire` | 5 | Questionnaire |
| `convocation` | 6 | Convocation |
| `other` | 7 | Autre (valeur par défaut / types inconnus) |
| `mutualInsuranceCard` | 8 | Carte Mutuelle |
| `workAccidentCertificate` | 9 | Attestation Accident Travail |
| `occupationalDiseaseCertificate` | 10 | Attestation Maladie professionnelle |
| `cssRightsCertificate` | 11 | attestation de droits CSS |
| `urineTest` | 12 | Analyse d'urine |
| `signedConsent` | 13 | Consentement signé |
| `cardiologistLetter` | 14 | Lettre cardiologue |
| `bhcgResults` | 15 | Résultats BHCG |
| `coagulationResults` | 16 | Résultats coag |
| `creatinineResults` | 17 | Résultats créatinémie |
| `calciumResults` | 18 | Résultats calcémie |
| `psaResults` | 19 | Résultats PSA |
| `t21ScreeningResults` | 20 | Résultats dépistage combiné T21 |
| `implantCard` | 21 | Carte DMI |
| `hospitalizationForm` | 22 | Bon hospi |
| `careAuthorization` | 23 | Autorisation soins mineurs / majeurs protégés |
| `implantCompatibilityForm` | 24 | Fiche compatibilité DMI |
| `implantSurgeryReport` | 25 | CR opératoire pose DMI |
| `mriQuestionnaire` | 26 | Questionnaire IRM |
| `kneeQuestionnaire` | 27 | Questionnaire genou |
| `endometriosisQuestionnaire` | 28 | Questionnaire endométriose |
| `ctScanQuestionnaire` | 29 | Questionnaire scanner |
| `spineQuestionnaire` | 30 | Questionnaire rachis |
| `shoulderQuestionnaire` | 31 | Questionnaire épaule |
| `boneDensitometryQuestionnaire` | 32 | Questionnaire Ostéodensitométrie |
| `pediatricExamFollowUpForm` | 33 | Fiche de suivi examen pédiatrique |
| `quote` | 34 | Devis |
| `staffReviewForm` | 35 | Fiche retour de Staff |
| `pathologyResults` | 36 | Résultats Anapath |
| `mammographyQuestionnaire` | 37 | Questionnaire Mammo |
| `skullQuestionnaire` | 38 | Questionnaire Crâne |
| `pelvicUltrasoundReport` | 39 | Compte Rendu Échographie Pelvienne |
| `lumbarMriReport` | 40 | Compte rendu IRM lombaire de moins de 6 mois |
| `cervicalMriReport` | 41 | Compte rendu IRM cervical de moins de 3 mois |

Note : la valeur EasyDoct `0` (`Unknown`) n'est jamais émise sur le contrat ; en
réception elle serait traitée comme `other`.
