// Guided factual intake and the intake agent (Phase 8; Master Plan v2.0 journey §15.1 steps 3–5,
// Module H personal legal assistant). Questions are per legal category; the intake agent turns the
// answers into a research question, the facts to prove, missing information and suggested tasks.
// It runs through runAgent (authorised, isolated, recorded) with the deterministic mock provider.
// It gives no legal conclusions and invents no deadlines: it asks the user to verify them.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createMockProvider,
  DATA_ISOLATION_NOTICE,
  runAgent,
  type ModelProvider,
} from '../ai/core.ts';

type RpcClient = Pick<SupabaseClient, 'rpc'>;

export const LEGAL_CATEGORIES = [
  'employment',
  'housing',
  'consumer',
  'family',
  'immigration',
  'administrative',
  'contract',
  'tort',
  'criminal',
  'other',
] as const;
export type LegalCategory = (typeof LEGAL_CATEGORIES)[number];

export interface IntakeQuestion {
  key: string;
  label: string;
  kind: 'text' | 'date' | 'longtext';
  required: boolean;
  /** Role the answer plays in the summary. */
  role?: 'counterparty' | 'event_date' | 'event' | 'goal' | 'documents' | 'deadline_hint';
}

const COMMON: IntakeQuestion[] = [
  {
    key: 'what_happened',
    label: 'What happened? Describe the events in your own words.',
    kind: 'longtext',
    required: true,
    role: 'event',
  },
  {
    key: 'when',
    label: 'When did the main event happen?',
    kind: 'date',
    required: true,
    role: 'event_date',
  },
  { key: 'goal', label: 'What outcome do you want?', kind: 'text', required: true, role: 'goal' },
  {
    key: 'documents',
    label: 'Which documents do you have (letters, contracts, emails)?',
    kind: 'text',
    required: false,
    role: 'documents',
  },
  {
    key: 'received_deadline',
    label: 'Has anyone given you a deadline? Quote it if so.',
    kind: 'text',
    required: false,
    role: 'deadline_hint',
  },
];
const SPECIFIC: Partial<Record<LegalCategory, IntakeQuestion[]>> = {
  employment: [
    {
      key: 'employer',
      label: 'Who is (or was) your employer?',
      kind: 'text',
      required: true,
      role: 'counterparty',
    },
    {
      key: 'employed_since',
      label: 'Since when have you been employed?',
      kind: 'date',
      required: false,
    },
    { key: 'position', label: 'What is your position?', kind: 'text', required: false },
  ],
  housing: [
    {
      key: 'landlord',
      label: 'Who is the landlord (or tenant)?',
      kind: 'text',
      required: true,
      role: 'counterparty',
    },
    { key: 'lease_start', label: 'When did the lease start?', kind: 'date', required: false },
  ],
  consumer: [
    {
      key: 'seller',
      label: 'Who sold the product or service?',
      kind: 'text',
      required: true,
      role: 'counterparty',
    },
    { key: 'purchase_date', label: 'When did you buy it?', kind: 'date', required: false },
    { key: 'price', label: 'What did it cost?', kind: 'text', required: false },
  ],
  family: [
    {
      key: 'other_party',
      label: 'Who is the other party?',
      kind: 'text',
      required: true,
      role: 'counterparty',
    },
  ],
  immigration: [
    {
      key: 'authority',
      label: 'Which authority made or will make the decision?',
      kind: 'text',
      required: true,
      role: 'counterparty',
    },
    {
      key: 'decision_date',
      label: 'When was the decision received?',
      kind: 'date',
      required: false,
    },
  ],
  administrative: [
    {
      key: 'authority',
      label: 'Which authority made the decision?',
      kind: 'text',
      required: true,
      role: 'counterparty',
    },
    {
      key: 'decision_date',
      label: 'When was the decision received?',
      kind: 'date',
      required: false,
    },
  ],
  contract: [
    {
      key: 'counterparty',
      label: 'Who is the other contracting party?',
      kind: 'text',
      required: true,
      role: 'counterparty',
    },
  ],
  tort: [
    {
      key: 'responsible',
      label: 'Who do you think is responsible?',
      kind: 'text',
      required: true,
      role: 'counterparty',
    },
  ],
};

export function intakeQuestions(category: LegalCategory): IntakeQuestion[] {
  return [...(SPECIFIC[category] ?? []), ...COMMON];
}

export type IntakeAnswers = Record<string, string>;

export function validateIntake(
  category: string,
  answers: IntakeAnswers,
): { category: LegalCategory; answers: IntakeAnswers; missing: string[] } {
  if (!(LEGAL_CATEGORIES as readonly string[]).includes(category))
    throw new Error('MATTER_CATEGORY_INVALID');
  const questions = intakeQuestions(category as LegalCategory);
  const clean: IntakeAnswers = {};
  for (const q of questions) {
    const value = (answers[q.key] ?? '').trim().slice(0, q.kind === 'longtext' ? 6000 : 500);
    if (value && q.kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new Error('MATTER_INTAKE_INVALID');
    if (value) clean[q.key] = value;
  }
  const missing = questions.filter((q) => q.required && !clean[q.key]).map((q) => q.key);
  return { category: category as LegalCategory, answers: clean, missing };
}

export interface IntakeSummary {
  researchQuestion: string;
  facts: string[];
  missingInformation: string[];
  suggestedTasks: { title: string; priority: 'low' | 'normal' | 'high' }[];
  suggestedParties: { name: string; role: 'opposing_party' | 'authority' }[];
}

const TOPIC: Record<LegalCategory, string> = {
  employment: 'employment law',
  housing: 'tenancy law',
  consumer: 'consumer protection law',
  family: 'family law',
  immigration: 'immigration law',
  administrative: 'administrative law',
  contract: 'contract law',
  tort: 'the law of damages',
  criminal: 'criminal law',
  other: 'the applicable law',
};

/** Deterministic reference intake analysis, used by the mock provider. */
export function summariseIntake(input: {
  category: LegalCategory;
  jurisdictionCode: string;
  answers: IntakeAnswers;
}): IntakeSummary {
  const questions = intakeQuestions(input.category);
  const byRole = (role: IntakeQuestion['role']) =>
    questions
      .filter((q) => q.role === role)
      .map((q) => input.answers[q.key])
      .find(Boolean);
  const counterparty = byRole('counterparty');
  const goal = byRole('goal');
  const when = byRole('event_date');
  const event = byRole('event');
  const facts = questions
    .filter((q) => input.answers[q.key] && q.role !== 'goal' && q.role !== 'deadline_hint')
    .map(
      (q) =>
        `${q.label.replace(/\?$/, '')}: ${input.answers[q.key]!.replace(/\s+/g, ' ').slice(0, 300)}`,
    );
  const missingInformation = questions.filter((q) => !input.answers[q.key]).map((q) => q.label);
  const suggestedTasks: IntakeSummary['suggestedTasks'] = [
    { title: 'Collect and upload the documents mentioned in the intake', priority: 'normal' },
    {
      title: `Verify any limitation, complaint or appeal deadline under ${TOPIC[input.category]} in ${input.jurisdictionCode}`,
      priority: 'high',
    },
  ];
  const hint = byRole('deadline_hint');
  if (hint)
    suggestedTasks.unshift({
      title: `Record the deadline you were given: “${hint.slice(0, 120)}”`,
      priority: 'high',
    });
  if (!when)
    suggestedTasks.push({
      title: 'Establish the exact date of the main event',
      priority: 'normal',
    });
  const researchQuestion = [
    `Under ${TOPIC[input.category]} in ${input.jurisdictionCode}`,
    counterparty ? `, what rights do I have against ${counterparty}` : ', what rights do I have',
    event ? ` after this: ${event.replace(/\s+/g, ' ').slice(0, 160)}` : '',
    goal ? `, and can I obtain ${goal.replace(/\.$/, '')}?` : '?',
  ].join('');
  return {
    researchQuestion: researchQuestion.slice(0, 600),
    facts,
    missingInformation,
    suggestedTasks,
    suggestedParties: counterparty
      ? [
          {
            name: counterparty.slice(0, 300),
            role: ['immigration', 'administrative'].includes(input.category)
              ? 'authority'
              : 'opposing_party',
          },
        ]
      : [],
  };
}

export function validateIntakeSummary(raw: unknown): IntakeSummary {
  const fail = (): never => {
    throw new Error('AI_OUTPUT_INVALID');
  };
  if (!raw || typeof raw !== 'object') fail();
  const value = raw as Record<string, unknown>;
  const strings = (list: unknown, max: number) =>
    Array.isArray(list) &&
    list.length <= max &&
    list.every((s) => typeof s === 'string' && s.length <= 1000)
      ? (list as string[])
      : fail();
  if (
    typeof value.researchQuestion !== 'string' ||
    value.researchQuestion.length < 3 ||
    value.researchQuestion.length > 600
  )
    fail();
  const tasks =
    Array.isArray(value.suggestedTasks) && value.suggestedTasks.length <= 20
      ? value.suggestedTasks
      : fail();
  const parties =
    Array.isArray(value.suggestedParties) && value.suggestedParties.length <= 10
      ? value.suggestedParties
      : fail();
  return {
    researchQuestion: value.researchQuestion as string,
    facts: strings(value.facts, 50),
    missingInformation: strings(value.missingInformation, 50),
    suggestedTasks: (tasks as Record<string, unknown>[]).map((t) =>
      typeof t.title === 'string' &&
      t.title.length <= 300 &&
      ['low', 'normal', 'high'].includes(t.priority as string)
        ? { title: t.title, priority: t.priority as 'low' | 'normal' | 'high' }
        : fail(),
    ),
    suggestedParties: (parties as Record<string, unknown>[]).map((p) =>
      typeof p.name === 'string' &&
      p.name.length <= 300 &&
      (p.role === 'opposing_party' || p.role === 'authority')
        ? { name: p.name, role: p.role }
        : fail(),
    ),
  };
}

export const intakeMockProvider: ModelProvider = createMockProvider({
  intake: (request) =>
    JSON.stringify(
      summariseIntake(request.structuredInput as Parameters<typeof summariseIntake>[0]),
    ),
});

export async function analyseIntake(
  client: RpcClient,
  scope: { organizationId: string; workspaceId: string },
  input: { category: LegalCategory; jurisdictionCode: string; answers: IntakeAnswers },
  provider: ModelProvider = intakeMockProvider,
): Promise<{ summary: IntakeSummary; executionId: string; safetyFlags: string[] }> {
  const { executionId, output, safetyFlags } = await runAgent({
    client,
    scope,
    provider,
    request: {
      agentKey: 'intake',
      promptVersion: 'intake-1.0.0',
      system: `You are the Njumeni intake agent. You organise a person's account of their situation; you do not give legal advice. ${DATA_ISOLATION_NOTICE}`,
      instructions:
        'Return JSON {researchQuestion, facts[], missingInformation[], suggestedTasks[{title,priority}], suggestedParties[{name,role}]}. ' +
        'Never state a deadline as fact; ask the user to verify deadlines.',
      data: Object.entries(input.answers).map(([key, text]) => ({
        id: `answer:${key}`,
        kind: 'question' as const,
        text,
      })),
      structuredInput: input,
      maxOutputTokens: 2000,
    },
    parse: (text) => {
      try {
        return validateIntakeSummary(JSON.parse(text));
      } catch (error) {
        throw error instanceof Error && error.message.startsWith('AI_')
          ? error
          : new Error('AI_OUTPUT_INVALID');
      }
    },
    inputRefs: { category: input.category, jurisdiction: input.jurisdictionCode },
  });
  return { summary: output, executionId, safetyFlags };
}
