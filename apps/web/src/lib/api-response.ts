// Consistent JSON error responses for /api/v1 (Master Plan v2.0 §13.2).
import { randomUUID } from 'node:crypto';

export type ApiErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'not_configured'
  | 'internal_error';

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 400,
  not_configured: 501,
  internal_error: 500,
};

export function apiError(code: ApiErrorCode, message: string, detail?: string): Response {
  const requestId = randomUUID();
  return Response.json(
    { error: { code, message, ...(detail ? { detail } : {}), requestId } },
    { status: STATUS[code], headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } },
  );
}

export function apiJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Maps stable engine error codes to API errors without leaking internal detail. */
export function apiErrorFromCode(code: string): Response {
  if (/NOT_AUTHORISED/.test(code))
    return apiError('forbidden', 'You do not have access to this resource.');
  if (/_INVALID$|_UNKNOWN$|_REQUIRED$/.test(code))
    return apiError('invalid_request', 'The request is invalid.', code);
  if (/NOT_CONFIGURED/.test(code))
    return apiError('not_configured', 'This capability is not configured.', code);
  return apiError('internal_error', 'The request could not be completed.');
}
