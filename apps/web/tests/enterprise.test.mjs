import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_KEY_PATTERN,
  bearerApiKey,
  keyErrorStatus,
} from '../src/modules/enterprise/api-keys.ts';

const KEY = `njk_0123abcd_${'a'.repeat(48)}`;
const req = (value) => ({ headers: new Headers(value ? { authorization: value } : {}) });

test('API keys are read only from a Bearer header with the Njumeni format', () => {
  assert.ok(API_KEY_PATTERN.test(KEY));
  assert.equal(bearerApiKey(req(`Bearer ${KEY}`)), KEY);
  assert.equal(bearerApiKey(req(`bearer ${KEY}`)), KEY);
  assert.equal(bearerApiKey(req(null)), null, 'no header means session authentication');
  assert.equal(
    bearerApiKey(req('Bearer eyJhbGciOi.jwt.token')),
    null,
    'other bearer tokens are not API keys',
  );
  assert.equal(bearerApiKey(req('Bearer njk_short')), 'malformed');
  assert.equal(bearerApiKey(req(`Basic ${KEY}`)), null);
});

test('key errors never reveal whether a key exists', () => {
  assert.equal(keyErrorStatus('API_KEY_INVALID'), 'unauthenticated');
  assert.equal(keyErrorStatus('API_KEY_SCOPE'), 'forbidden');
  assert.equal(keyErrorStatus('RESEARCH_NOT_AUTHORISED'), 'not_found');
});
