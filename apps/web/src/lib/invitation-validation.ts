const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInvitationEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function parseInvitationExpiryDays(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return 7;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const days = Number(value);
  return Number.isSafeInteger(days) && days >= 1 && days <= 30 ? days : null;
}
