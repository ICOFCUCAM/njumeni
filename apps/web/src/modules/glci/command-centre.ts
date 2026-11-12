// GLCI-07: Super Admin AI command centre (docs/GLCI_SPECIFICATION.md §5).
//
// An operator asks in plain language (English or Norwegian). The command centre recognises the
// intent, consults live GLCI data through operator RPCs, and answers with the evidence it used and
// the actions it proposes. Until an AI provider is configured (GLCI-08, owner decision D-5), the
// engine is deterministic: every statement comes from the database, nothing is invented.
// Repository changes are never made from here. They become engineering requests that another
// operator approves and the controlled Claude Code integration executes (GLCI-09).

export type CommandIntent =
  | 'examine_outdated'
  | 'explain_lag'
  | 'update_connector'
  | 'coverage_report'
  | 'help';

export const COMMAND_ENGINE = 'njumeni-command-rules-1.0.0';

const JURISDICTION_WORDS: readonly [RegExp, readonly string[]][] = [
  [/\b(europe|european|europa|europeisk|eu-?retten)\b/i, ['EU', 'EEA', 'NO', 'SE', 'DK', 'FI', 'GB']],
  [/\b(nordic|nordisk|scandinavia|skandinavia)\b/i, ['NO', 'SE', 'DK', 'FI']],
  [/\b(norway|norwegian|norsk|norske|norge|noreg)\b/i, ['NO']],
  [/\b(sweden|swedish|sverige|svensk)\b/i, ['SE']],
  [/\b(denmark|danish|danmark|dansk)\b/i, ['DK']],
  [/\b(finland|finnish|suomi|finsk)\b/i, ['FI']],
  [/\b(united kingdom|uk|britain|british|england|storbritannia)\b/i, ['GB']],
  [/\b(united states|usa|u\.s\.|american|federal)\b/i, ['US']],
  [/\b(european union|eu)\b/i, ['EU']],
  [/\b(cameroon|cameroun|kamerun)\b/i, ['CM']],
  [/\b(uganda)\b/i, ['UG']],
];

/** Topic words to authority-title terms (spec example 1: immigration). */
const TOPICS: readonly [RegExp, readonly string[]][] = [
  [/\b(immigration|immigrant|utlending|utlendinger|innvandring|asyl|asylum|visa|opphold)\b/i, ['utlending', 'innvandring', 'asyl', 'immigration', 'statsborger']],
  [/\b(employment|labour|labor|arbeid|arbeidsmiljø|working environment)\b/i, ['arbeidsmiljø', 'arbeid', 'ferie', 'employment']],
  [/\b(tax|skatt)\b/i, ['skatt', 'tax']],
  [/\b(privacy|data protection|personvern|personopplysning)\b/i, ['personopplysning', 'personvern', 'data protection']],
  [/\b(housing|tenancy|husleie|bolig)\b/i, ['husleie', 'bolig', 'housing']],
  [/\b(family|familie|barn|marriage|ekteskap)\b/i, ['barn', 'ekteskap', 'familie']],
];

export function detectIntent(question: string): CommandIntent {
  const q = question.toLowerCase();
  if (/\b(update|fix|repair|adapt|oppdater|reparer|endre)\b.*\b(connector|adapter|ingestion|integration|format|parser|monitor|kobling|innlesing)\b/.test(q)) {
    return 'update_connector';
  }
  if (/\b(why|hvorfor|reason|årsak)\b/.test(q) && /\b(behind|outdated|late|lag|bak|utdatert|latest|nyeste|stale)\b/.test(q)) return 'explain_lag';
  if (/\b(outdated|out of date|utdatert|obsolete|examine|undersøk|check whether .* using|bruker .* gamle)\b/.test(q)) return 'examine_outdated';
  if (/\b(coverage|dekning|current|oppdatert|status|report|rapport)\b/.test(q)) return 'coverage_report';
  return 'help';
}

export function detectJurisdictions(question: string): string[] {
  const found = new Set<string>();
  for (const [pattern, codes] of JURISDICTION_WORDS) if (pattern.test(question)) codes.forEach(code => found.add(code));
  return [...found];
}

export function detectTopicTerms(question: string): string[] {
  const terms = new Set<string>();
  for (const [pattern, words] of TOPICS) if (pattern.test(question)) words.forEach(word => terms.add(word));
  return [...terms];
}

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
export interface CommandAnswer {
  intent: CommandIntent;
  engine: string;
  answer: string;
  jurisdictions: string[];
  data: Record<string, unknown>;
  actions: { label: string; kind: 'proposal_created' | 'suggestion'; reference?: string }[];
}

async function call<T>(rpc: Rpc, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error('GLCI_COMMAND_DATA_UNAVAILABLE');
  return data as T;
}

interface Currency {
  jurisdictionCode: string;
  verdict: string;
  reasons: string[];
  targets: Record<string, number>;
  knowledgeLag: { targetKey: string; changedAt: string; lastIngestedAt: string | null }[];
  completeness: { sourceKey: string; missing: number; passagesWithoutEmbedding: number }[];
}
const VERDICT_TEXT: Record<string, string> = {
  current: 'current — verified and up to date',
  behind: 'behind — Njumeni knows something it has not yet reflected',
  unverified: 'unverified — currency cannot be claimed (a source is unchecked, stale or failing)',
  not_monitored: 'not monitored — no official source is being watched yet',
};

export async function answerCommand(rpc: Rpc, question: string, conversationId: string): Promise<CommandAnswer> {
  const trimmed = question.trim();
  if (trimmed.length < 3 || trimmed.length > 4000) throw new Error('GLCI_COMMAND_INVALID');
  const intent = detectIntent(trimmed);
  const jurisdictions = detectJurisdictions(trimmed);
  const base = { intent, engine: COMMAND_ENGINE, jurisdictions };

  if (intent === 'coverage_report') {
    const codes = jurisdictions.length ? jurisdictions : null;
    const all = (await call<{ currency: Currency[] }>(rpc, 'glci_observatory')).currency;
    const rows = codes ? all.filter(c => codes.includes(c.jurisdictionCode)) : all;
    const missing = codes ? codes.filter(code => !rows.some(r => r.jurisdictionCode === code)) : [];
    const lines = rows.map(r => `• ${r.jurisdictionCode}: ${VERDICT_TEXT[r.verdict] ?? r.verdict}${r.reasons.length ? ' — ' + r.reasons.join(' ') : ''}`);
    if (missing.length) lines.push(`• ${missing.join(', ')}: no monitoring profile yet — not covered by currency verification.`);
    const current = rows.filter(r => r.verdict === 'current').length;
    return {
      ...base,
      answer: `Coverage report (${rows.length} jurisdiction(s); ${current} verified current):\n${lines.join('\n')}`,
      data: { currency: rows, notProfiled: missing },
      actions: rows.some(r => r.verdict === 'not_monitored')
        ? [{ kind: 'suggestion', label: 'Activate lawful monitoring targets (Registry) for jurisdictions that are not monitored.' }]
        : [],
    };
  }

  if (intent === 'explain_lag') {
    const codes = jurisdictions.length ? jurisdictions : ['NO'];
    const observatory = await call<{ currency: Currency[]; failedIngestion: unknown[]; itemFailures: number; sources: { jurisdictionCode: string; name: string; currency: string; consecutiveFailures: number }[] }>(rpc, 'glci_observatory');
    const findings: string[] = [];
    for (const code of codes) {
      const c = observatory.currency.find(x => x.jurisdictionCode === code);
      if (!c) { findings.push(`${code}: no monitoring profile, so lag cannot be measured.`); continue; }
      const failing = observatory.sources.filter(s => s.jurisdictionCode === code && ['check_failing', 'integration_failure', 'stale', 'not_checked'].includes(s.currency));
      if (failing.length) findings.push(`${code}: source health — ${failing.map(s => `${s.name} is ${s.currency.replace('_', ' ')}${s.consecutiveFailures ? ` (${s.consecutiveFailures} failed checks)` : ''}`).join('; ')}.`);
      if (c.knowledgeLag.length) findings.push(`${code}: ingestion lag — ${c.knowledgeLag.map(l => `${l.targetKey} changed ${l.changedAt.slice(0, 10)}, last ingested ${l.lastIngestedAt ? l.lastIngestedAt.slice(0, 10) : 'never'}`).join('; ')}.`);
      const gaps = c.completeness.filter(x => x.missing > 0 || x.passagesWithoutEmbedding > 0);
      if (gaps.length) findings.push(`${code}: indexing — ${gaps.map(g => `${g.sourceKey}: ${g.missing} missing authorities, ${g.passagesWithoutEmbedding} passages not embedded`).join('; ')}.`);
      if (!failing.length && !c.knowledgeLag.length && !gaps.length) findings.push(`${code}: ${VERDICT_TEXT[c.verdict] ?? c.verdict}. ${c.reasons.join(' ')}`.trim());
    }
    if (observatory.failedIngestion.length) findings.push(`Ingestion: ${observatory.failedIngestion.length} recent failed or partial run(s).`);
    if (observatory.itemFailures) findings.push(`Ingestion: ${observatory.itemFailures} item(s) pending retry or abandoned.`);
    return {
      ...base, jurisdictions: codes,
      answer: `Why the knowledge base may be behind:\n${findings.map(f => '• ' + f).join('\n')}`,
      data: { currency: observatory.currency.filter(c => codes.includes(c.jurisdictionCode)), failedIngestion: observatory.failedIngestion, itemFailures: observatory.itemFailures },
      actions: [{ kind: 'suggestion', label: 'Open Issues: re-sync proposals and engineering tasks are listed there for approval.' }],
    };
  }

  if (intent === 'examine_outdated') {
    const code = jurisdictions[0] ?? 'NO';
    const terms = detectTopicTerms(trimmed);
    if (!terms.length) {
      return { ...base, jurisdictions: [code], data: {}, actions: [],
        answer: 'Which area of law should I examine? For example: "Examine Norwegian immigration legislation for outdated provisions."' };
    }
    const authorities = await call<{ citation: string | null; title: string; legalStatus: string; withdrawnFromSource: boolean; pendingCommencement: boolean; unreviewedChanges: number; claimsCitingSupersededText: number; effectiveFrom: string | null }[]>(
      rpc, 'glci_examine_authorities', { p_jurisdiction_code: code, p_terms: terms, p_limit: 100 });
    const currency = await call<Currency>(rpc, 'glci_currency', { p_jurisdiction_code: code });
    const problems = authorities.filter(a => a.withdrawnFromSource || a.unreviewedChanges > 0 || a.claimsCitingSupersededText > 0 || a.legalStatus === 'unknown');
    const lines = problems.map(a => `• ${a.citation ?? a.title}: ${[
      a.withdrawnFromSource ? 'no longer in the official dataset (possible repeal)' : null,
      a.unreviewedChanges ? `${a.unreviewedChanges} unreviewed change(s)` : null,
      a.claimsCitingSupersededText ? `${a.claimsCitingSupersededText} research claim(s) cite superseded text` : null,
      a.pendingCommencement ? `changes take effect ${a.effectiveFrom}` : null,
    ].filter(Boolean).join('; ')}`);
    const verdictLine = `Jurisdiction status: ${VERDICT_TEXT[currency.verdict] ?? currency.verdict}.`;
    return {
      ...base, jurisdictions: [code],
      answer: authorities.length === 0
        ? `${verdictLine}\nNo ${code} authorities matching ${terms.join(', ')} are in Njumeni's legal knowledge yet — the area is not covered, so outdated provisions cannot be ruled out.`
        : `${verdictLine}\nExamined ${authorities.length} ${code} authorit${authorities.length === 1 ? 'y' : 'ies'} matching ${terms.join(', ')}. ` +
          (problems.length ? `${problems.length} need attention:\n${lines.join('\n')}` : 'None shows a known outdated provision, unreviewed change or superseded citation.') +
          (currency.verdict !== 'current' ? `\nCaution: ${currency.reasons.join(' ')}` : ''),
      data: { terms, authorities, currency },
      actions: problems.length ? [{ kind: 'suggestion', label: 'Review the listed changes under Issues and approve notifications to affected workspaces.' }] : [],
    };
  }

  if (intent === 'update_connector') {
    const code = jurisdictions[0] ?? 'NO';
    const registry = await call<{ code: string; targets: { targetKey: string; monitorAdapter: string | null; status: string }[] }[]>(rpc, 'glci_registry');
    const target = registry.find(j => j.code === code)?.targets.find(t => t.monitorAdapter && t.status === 'active')
      ?? registry.find(j => j.code === code)?.targets.find(t => t.monitorAdapter);
    const created = await call<{ issueId: string; proposalId: string }>(rpc, 'glci_request_engineering_task', {
      p_jurisdiction_code: code, p_target_key: target?.targetKey ?? null, p_instruction: trimmed, p_conversation_id: conversationId,
    });
    return {
      ...base, jurisdictions: [code],
      answer: `I have opened an engineering request for ${code}${target ? ` (${target.targetKey})` : ''}. ` +
        'The engineering agent will inspect the repository, change the connector, run the tests and prepare a pull request — ' +
        'only after another operator approves the task. Nothing reaches production without review and the normal deployment approval.',
      data: { issueId: created.issueId, proposalId: created.proposalId, targetKey: target?.targetKey ?? null },
      actions: [{ kind: 'proposal_created', label: 'Engineering task awaiting a second operator\'s approval', reference: created.proposalId }],
    };
  }

  return {
    ...base, data: {}, actions: [],
    answer: 'I can: examine an area of law for outdated provisions ("Examine Norwegian immigration legislation…"), explain why knowledge is behind ("Why is our knowledge base behind…?"), report coverage ("Is our European coverage current?"), or open an engineering request ("Update the Norwegian ingestion connector…").',
  };
}
