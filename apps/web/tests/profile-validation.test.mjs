import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isValidHttpsUrl,
  isValidTimeZone,
  normalizeProfileLocale,
} from '../src/lib/profile-validation.ts';

test('HTTPS avatar validation accepts valid secure URLs only', () => {
  assert.equal(isValidHttpsUrl('https://example.com/avatar.png'), true);
  assert.equal(isValidHttpsUrl('HTTPS://example.com/avatar.png'), true);
  assert.equal(isValidHttpsUrl('HtTpS://example.com/avatar.png'), true);
  assert.equal(isValidHttpsUrl('http://example.com/avatar.png'), false);
  assert.equal(isValidHttpsUrl('https://'), false);
  assert.equal(isValidHttpsUrl('https://user:pass@example.com/a.png'), false);
  assert.equal(isValidHttpsUrl('javascript:alert(1)'), false);
  assert.equal(isValidHttpsUrl('https://example.com/' + 'a'.repeat(2048)), false);
});

test('time-zone validation accepts IANA zones and rejects unknown values', () => {
  assert.equal(isValidTimeZone('UTC'), true);
  assert.equal(isValidTimeZone('Europe/Oslo'), true);
  assert.equal(isValidTimeZone('America/New_York'), true);
  assert.equal(isValidTimeZone('Mars/Olympus_Mons'), false);
  assert.equal(isValidTimeZone(''), false);
  assert.equal(isValidTimeZone('x'.repeat(101)), false);
});

test('profile locale normalization applies a stable default and rejects malformed tags', () => {
  assert.equal(normalizeProfileLocale(''), 'en');
  assert.equal(normalizeProfileLocale('en'), 'en');
  assert.equal(normalizeProfileLocale('en-GB'), 'en-GB');
  assert.equal(normalizeProfileLocale('invalid_locale'), null);
});
