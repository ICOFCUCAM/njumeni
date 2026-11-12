// Interface localisation (Phase 12, U-22): English, Norwegian Bokmål and French for navigation and
// the core legal disclaimers. The locale comes from the user's profile, then the browser.
export const LOCALES = ['en', 'nb', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

const MESSAGES = {
  en: {
    'nav.workspace': 'Workspace',
    'nav.overview': 'Overview',
    'nav.intelligence': 'Intelligence',
    'nav.legal_intelligence': 'Legal intelligence',
    'nav.research': 'Legal research',
    'nav.review': 'Human review',
    'nav.jurisdictions': 'Jurisdictions',
    'nav.casework': 'Casework',
    'nav.matters': 'Matters and cases',
    'nav.evidence': 'Evidence',
    'nav.documents': 'Documents',
    'nav.arguments': 'Arguments',
    'nav.workspaces': 'Workspaces',
    'nav.assistant': 'Personal assistant',
    'nav.professional': 'Professional workspace',
    'nav.organisation': 'Law firm and enterprise',
    'nav.institutional': 'Institutional workspace',
    'nav.account': 'Account',
    'nav.billing': 'Plan and usage',
    'disclaimer.legal_information': 'This is legal information, not legal advice.',
    'dashboard.title': 'Your legal work, clearly organised.',
  },
  nb: {
    'nav.workspace': 'Arbeidsområde',
    'nav.overview': 'Oversikt',
    'nav.intelligence': 'Analyse',
    'nav.legal_intelligence': 'Juridisk analyse',
    'nav.research': 'Rettskildesøk',
    'nav.review': 'Manuell kontroll',
    'nav.jurisdictions': 'Jurisdiksjoner',
    'nav.casework': 'Saksbehandling',
    'nav.matters': 'Saker',
    'nav.evidence': 'Bevis',
    'nav.documents': 'Dokumenter',
    'nav.arguments': 'Argumentasjon',
    'nav.workspaces': 'Arbeidsområder',
    'nav.assistant': 'Personlig assistent',
    'nav.professional': 'Profesjonelt arbeidsområde',
    'nav.organisation': 'Advokatfirma og virksomhet',
    'nav.institutional': 'Offentlig virksomhet',
    'nav.account': 'Konto',
    'nav.billing': 'Abonnement og forbruk',
    'disclaimer.legal_information': 'Dette er juridisk informasjon, ikke juridisk rådgivning.',
    'dashboard.title': 'Ditt juridiske arbeid, oversiktlig organisert.',
  },
  fr: {
    'nav.workspace': 'Espace de travail',
    'nav.overview': 'Vue d’ensemble',
    'nav.intelligence': 'Analyse',
    'nav.legal_intelligence': 'Analyse juridique',
    'nav.research': 'Recherche juridique',
    'nav.review': 'Contrôle humain',
    'nav.jurisdictions': 'Juridictions',
    'nav.casework': 'Dossiers',
    'nav.matters': 'Affaires et dossiers',
    'nav.evidence': 'Preuves',
    'nav.documents': 'Documents',
    'nav.arguments': 'Argumentation',
    'nav.workspaces': 'Espaces',
    'nav.assistant': 'Assistant personnel',
    'nav.professional': 'Espace professionnel',
    'nav.organisation': 'Cabinet et entreprise',
    'nav.institutional': 'Espace institutionnel',
    'nav.account': 'Compte',
    'nav.billing': 'Abonnement et consommation',
    'disclaimer.legal_information':
      'Il s’agit d’une information juridique, et non d’un conseil juridique.',
    'dashboard.title': 'Votre travail juridique, clairement organisé.',
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)['en'];

export function t(locale: Locale, key: MessageKey): string {
  return MESSAGES[locale][key] ?? MESSAGES.en[key];
}

/** Profile locale first ("nb-NO", "fr"), then Accept-Language, then English. Nynorsk falls back to Bokmål. */
export function resolveLocale(
  profileLocale: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  const candidates = [
    profileLocale ?? '',
    ...(acceptLanguage ?? '').split(',').map((part) => part.split(';')[0]!.trim()),
  ];
  for (const candidate of candidates) {
    const base = candidate.toLowerCase().split(/[-_]/)[0];
    if (base === 'nb' || base === 'no' || base === 'nn') return 'nb';
    if (base === 'fr') return 'fr';
    if (base === 'en') return 'en';
  }
  return 'en';
}

export function messageKeys(): MessageKey[] {
  return Object.keys(MESSAGES.en) as MessageKey[];
}
export function messagesFor(locale: Locale): Record<MessageKey, string> {
  return MESSAGES[locale] as Record<MessageKey, string>;
}

/** English navigation labels mapped to message keys, for the workspace shell. */
const NAV_KEYS: Record<string, MessageKey> = {
  Workspace: 'nav.workspace',
  Overview: 'nav.overview',
  Intelligence: 'nav.intelligence',
  'Legal intelligence': 'nav.legal_intelligence',
  'Legal research': 'nav.research',
  'Human review': 'nav.review',
  Jurisdictions: 'nav.jurisdictions',
  Casework: 'nav.casework',
  'Matters and cases': 'nav.matters',
  Evidence: 'nav.evidence',
  Documents: 'nav.documents',
  Arguments: 'nav.arguments',
  Workspaces: 'nav.workspaces',
  'Personal assistant': 'nav.assistant',
  'Professional workspace': 'nav.professional',
  'Law firm and enterprise': 'nav.organisation',
  'Institutional workspace': 'nav.institutional',
  Account: 'nav.account',
  'Plan and usage': 'nav.billing',
};

export function navigationLabels(locale: Locale): Record<string, string> {
  return Object.fromEntries(
    Object.entries(NAV_KEYS).map(([english, key]) => [english, t(locale, key)]),
  );
}
