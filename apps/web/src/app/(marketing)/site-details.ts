// Owner-supplied facts for the public site. Anything left `null` is shown as "to be published
// before launch" — never invented. Fill these in (or ask for them to be filled in) once confirmed.
export const SITE_DETAILS = {
  /** Registered legal name of the company that operates Njumeni. */
  legalName: null as string | null,
  /** Organisation number (for a Norwegian company, from the Brønnøysund Register Centre). */
  organisationNumber: null as string | null,
  /** Registered business address. */
  registeredAddress: null as string | null,
  /** General contact address. */
  contactEmail: null as string | null,
  /** Address for privacy requests and the data protection contact. */
  privacyEmail: null as string | null,
  /** Address for reporting security vulnerabilities. */
  securityEmail: null as string | null,
  /** The law that governs the terms of service, and the courts. */
  governingLaw: null as string | null,
  /** Date the legal documents were approved; while null they are marked as drafts. */
  legalApprovedOn: null as string | null,
};

export const PENDING = 'To be published before launch';
export const show = (value: string | null) => value ?? PENDING;

// Verified facts used across the trust pages (see docs/PHASE_REGISTER.md and the migrations).
export const FACTS = {
  databaseRegion: 'EU — Stockholm, Sweden (eu-north-1)',
  earlyAccessRetention: '12 months',
};
