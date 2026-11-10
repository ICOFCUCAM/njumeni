export function isValidHttpsUrl(value: string): boolean {
  if (!value || value.length > 2048) return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}

export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 100) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function normalizeProfileLocale(value: string): string | null {
  if (!value) return 'en';
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value) ? value : null;
}
