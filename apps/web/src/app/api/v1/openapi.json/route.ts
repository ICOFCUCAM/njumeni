// OpenAPI description of the public API (Master Plan v2.0 §13). Hand-maintained for now; a
// contract test keeps it aligned with the route handlers.
export const dynamic = 'force-static';

const errorSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message', 'requestId'],
      properties: {
        code: {
          type: 'string',
          enum: [
            'unauthenticated',
            'forbidden',
            'not_found',
            'invalid_request',
            'not_configured',
            'internal_error',
          ],
        },
        message: { type: 'string' },
        detail: { type: 'string' },
        requestId: { type: 'string', format: 'uuid' },
      },
    },
  },
};

const claimSchema = {
  type: 'object',
  properties: {
    ordinal: { type: 'integer' },
    category: {
      type: 'string',
      enum: [
        'verified_authority',
        'interpretation',
        'factual_assumption',
        'inference',
        'unresolved_question',
        'conflicting_authority',
      ],
    },
    statement: { type: 'string' },
    citation: { type: ['string', 'null'] },
    quotedText: { type: ['string', 'null'] },
    verificationStatus: { type: 'string', enum: ['verified', 'failed', 'not_applicable'] },
    failureCodes: { type: 'array', items: { type: 'string' } },
    passageId: { type: ['string', 'null'], format: 'uuid' },
    authorityTitle: { type: ['string', 'null'] },
    authorityCitation: { type: ['string', 'null'] },
    validFrom: { type: ['string', 'null'], format: 'date' },
    validUntil: { type: ['string', 'null'], format: 'date' },
    sourceUri: { type: ['string', 'null'] },
  },
};

const runSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    question: { type: 'string' },
    jurisdictionCode: { type: 'string' },
    asOfDate: { type: 'string', format: 'date' },
    status: { type: 'string', enum: ['answered', 'abstained'] },
    coverageLevel: {
      type: 'string',
      enum: ['catalogued', 'planned', 'pilot', 'partial', 'supported', 'suspended'],
    },
    limitations: { type: 'array', items: { type: 'string' } },
    engineVersion: { type: 'string' },
    claims: { type: 'array', items: claimSchema },
    findings: { type: 'array', items: { type: 'object' } },
    checks: { type: 'array', items: { type: 'object' } },
  },
};

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Njumeni API',
    version: '1.0.0-phase4',
    description:
      'Legal research with database-verified citations. Every legal claim is checked for existence, resolution to a stored version, currency on the research date, source rights and verbatim quotation. Authentication is the signed-in session cookie; API keys arrive in Phase 10.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'sb-access-token' } },
    schemas: { Error: errorSchema, ResearchRun: runSchema, Claim: claimSchema },
  },
  security: [{ session: [] }],
  paths: {
    '/research/runs': {
      get: {
        summary: 'List research runs in a workspace',
        parameters: [
          {
            name: 'organizationId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'workspaceId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: 'Research history' },
          '400': {
            description: 'Invalid request',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Not signed in',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description: 'No research permission',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
      post: {
        summary: 'Run verified legal research',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: [
                  'organizationId',
                  'workspaceId',
                  'question',
                  'jurisdictionCode',
                  'asOfDate',
                  'languageCodes',
                ],
                properties: {
                  organizationId: { type: 'string', format: 'uuid' },
                  workspaceId: { type: 'string', format: 'uuid' },
                  question: { type: 'string', minLength: 3, maxLength: 4000 },
                  jurisdictionCode: { type: 'string', example: 'NO' },
                  asOfDate: {
                    type: 'string',
                    format: 'date',
                    description: 'The law is applied as it stood on this date.',
                  },
                  languageCodes: { type: 'array', items: { type: 'string' }, example: ['nb'] },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Recorded run with verified claim ledger',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/ResearchRun' } },
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Not signed in',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description: 'No research permission',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/research/runs/{runId}': {
      get: {
        summary: 'Get a research run with its claim ledger and citation checks',
        parameters: [
          { name: 'runId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Research run',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/ResearchRun' } },
                },
              },
            },
          },
          '401': {
            description: 'Not signed in',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Not found or not accessible',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/matters/{matterId}/export': {
      get: {
        summary:
          'Export a case bundle (ZIP): case report PDF, chronology CSV, approved documents (PDF and DOCX), evidence manifest and a SHA-256 manifest. The export is recorded in the matter history',
        parameters: [
          {
            name: 'matterId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'The case bundle. X-Content-SHA256 carries the archive hash',
            content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } },
          },
          '400': {
            description: 'Invalid identifier',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Not signed in',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Not found or not accessible',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/documents/{documentId}/export': {
      get: {
        summary:
          'Export a document version as DOCX or PDF. Versions other than the approved one are marked DRAFT; every export is recorded with its SHA-256',
        parameters: [
          {
            name: 'documentId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'format',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['docx', 'pdf'] },
          },
          {
            name: 'version',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1 },
          },
        ],
        responses: {
          '200': {
            description:
              'The exported file. X-Document-Final says whether it is the approved version',
            content: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
                schema: { type: 'string', format: 'binary' },
              },
              'application/pdf': { schema: { type: 'string', format: 'binary' } },
            },
          },
          '400': {
            description: 'Invalid format or version',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Not signed in',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Not found or not accessible',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
  },
} as const;

export function GET(): Response {
  return Response.json(document, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
