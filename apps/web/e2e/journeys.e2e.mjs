// Browser journeys (Phase 13 follow-up; master plan §15) through the real interface: forms,
// server actions, redirects and downloads, in headless Chromium against a running build.
// Requirements: a local Supabase stack (`supabase start`) and the built app (`next start`).
// Run: E2E_BASE_URL=http://127.0.0.1:3000 SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
//      E2E_DB_CONTAINER=supabase_db_njumeni npm run test:e2e
// All users and legal content are synthetic.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

// Playwright is resolved like CommonJS so a globally installed copy (NODE_PATH) works too.
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const PASSWORD = 'Journey-e2e-only-2026!';
const stamp = Date.now();

function sql(statement) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      process.env.E2E_DB_CONTAINER ?? 'supabase_db_njumeni',
      'psql',
      '-U',
      'postgres',
      '-q',
      '-t',
      '-A',
    ],
    {
      input: statement,
    },
  )
    .toString()
    .trim();
}

async function createUser(tag) {
  const email = `journey-${tag}-${stamp}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return { email, id: data.user.id };
}

let browser;
before(async () => {
  // One synthetic, rights-approved Norwegian provision to research against.
  sql(`insert into private.legal_sources (id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri, access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status)
    values ('e2e10000-0000-4000-8000-000000000001', 'NO', 'journey-source', 'Journey source', 'Synthetic', 'legislation', 'https://example.invalid', 'api', 'approved', 'T', 'T', true, 'active') on conflict do nothing;
  insert into private.legal_source_rights_evidence (source_id, terms_uri, reviewed_by, reviewed_at, permissions)
    values ('e2e10000-0000-4000-8000-000000000001', 'https://example.invalid/terms', 'reviewer', now(), '{"retrieve":true,"store":true,"index":true,"display":true,"quote":true}') on conflict do nothing;
  insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, citation, title, authority_type, language_code, legal_status)
    values ('e2e20000-0000-4000-8000-000000000001', 'e2e10000-0000-4000-8000-000000000001', 'NO', 'journey', 'SYN-AML-15-7', 'Arbeidsmiljøloven (syntetisk)', 'act', 'nb', 'in_force') on conflict do nothing;
  insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, source_content_hash, is_current_source_version)
    values ('e2e30000-0000-4000-8000-000000000001', 'e2e20000-0000-4000-8000-000000000001', 1, '2015-01-01', repeat('e', 64), true) on conflict do nothing;
  insert into private.legal_authority_passages (id, authority_version_id, ordinal, content, content_hash)
    values ('e2e40000-0000-4000-8000-000000000001', 'e2e30000-0000-4000-8000-000000000001', 0,
      'Arbeidstaker kan ikke sies opp uten at det er saklig begrunnet i virksomhetens, arbeidsgiverens eller arbeidstakerens forhold.', repeat('f', 64)) on conflict do nothing;`);
  browser = await chromium.launch();
});
after(async () => browser?.close());

async function signedIn(user) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel(/e-?mail/i).fill(user.email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard/),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);
  return { page, errors, context };
}

test('journey 15.1: intake → matter → research → verification → review → document → bundle', async () => {
  const user = await createUser('individual');
  const { page, errors } = await signedIn(user);

  // Guided intake opens a numbered matter with tasks and a research question.
  await page.goto(`${BASE}/matters`);
  await page.getByRole('link', { name: 'Employment' }).click();
  await page.getByLabel(/Matter title/).fill('Dismissal without reason');
  await page.getByLabel('Who is (or was) your employer?').fill('Acme AS');
  await page.getByLabel(/What happened\?/).fill('I was dismissed without any reason being given.');
  await page.getByLabel('When did the main event happen?').fill('2026-03-14');
  await page.getByLabel('What outcome do you want?').fill('reinstatement');
  await Promise.all([
    page.waitForURL(/\/matters\/[0-9a-f-]{36}$/),
    page.getByRole('button', { name: 'Open matter' }).click(),
  ]);
  const matterUrl = page.url();
  await assert.doesNotReject(
    page
      .getByText(/M-\d{4}-0001/)
      .first()
      .waitFor(),
  );
  assert.ok(await page.getByText('Intake summary').isVisible());
  assert.ok(
    await page
      .getByText(/Verify any limitation/)
      .first()
      .isVisible(),
    'the assistant asks for deadlines to be verified',
  );

  // The intake's research link pre-fills the research form; ask in Norwegian.
  await page.getByRole('link', { name: 'Research the intake question' }).click();
  await page.waitForURL(/\/research\?/);
  assert.match(
    await page.locator('textarea[name="question"]').inputValue(),
    /employment law in NO/,
  );
  await page
    .locator('textarea[name="question"]')
    .fill('Kan arbeidsgiver si opp en arbeidstaker uten saklig begrunnelse?');
  await Promise.all([
    page.waitForURL(/\/research\/[0-9a-f-]{36}$/),
    page.getByRole('button', { name: 'Research' }).click(),
  ]);
  const researchUrl = page.url();
  // Live research embeds the question when the runtime is installed; otherwise it says it used keywords only.
  if (await page.getByText('search: keyword only').isVisible())
    assert.ok(await page.getByText(/Meaning-based search was unavailable/).isVisible(), 'a keyword-only answer says so');
  else assert.ok(await page.getByText('search: keyword and meaning').isVisible(), 'the answer used keyword and meaning search');
  assert.ok(
    await page.getByText('✓ verified').first().isVisible(),
    'the answer cites a verified provision',
  );

  // Re-verification opens a review gate (pilot coverage), decided in the review queue.
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.getByRole('button', { name: /Re-verify against today/ }).click(),
  ]);
  await page
    .getByText(/Awaiting human review|Verified against the law/)
    .first()
    .waitFor();
  await page.getByRole('link', { name: 'Open human review' }).click();
  await page.waitForURL(/\/reviews/);
  for (
    let pending = await page.locator('button[value="approved"]').count();
    pending > 0;
    pending -= 1
  ) {
    await page.locator('button[value="approved"]').first().click();
    await page.waitForFunction(
      (left) => document.querySelectorAll('button[value="approved"]').length < left,
      pending,
    );
  }
  assert.ok((await page.getByText(/· Approved/).count()) >= 1, 'gates are approved');

  // A document from the research, drafted by the agent, submitted, approved and exported.
  await page.goto(`${BASE}/documents`);
  await page.getByLabel('Title').fill('Memo on dismissal');
  await page.getByLabel('Template (manage)').selectOption('research_memorandum');
  await page.getByLabel(/Based on research/).selectOption({ index: 1 });
  await Promise.all([
    page.waitForURL(/\/documents\/[0-9a-f-]{36}$/),
    page.getByRole('button', { name: 'Create' }).click(),
  ]);
  const documentUrl = page.url();
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.getByRole('button', { name: 'Draft with the drafting agent' }).click(),
  ]);
  await page.getByText(/drafted by the AI drafting agent/).waitFor();
  assert.ok(
    await page.getByText('SYN-AML-15-7').first().isVisible(),
    'the draft cites the verified provision',
  );
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.getByRole('button', { name: 'Submit for review' }).click(),
  ]);
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.getByRole('button', { name: /Approve version/ }).click(),
  ]);
  await page.getByText('this is the approved version').waitFor();
  // Downloads go through the real links (the session cookie is Secure in production builds).
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Export PDF' }).click(),
  ]);
  assert.match(
    pdf.suggestedFilename(),
    /^Memo-on-dismissal-v\d+\.pdf$/,
    'the approved version exports without a DRAFT marking',
  );
  assert.equal(
    readFileSync(await pdf.path())
      .subarray(0, 8)
      .toString('latin1'),
    '%PDF-1.4',
  );
  assert.ok(documentUrl);

  // Link the research and the document to the matter, then download the case bundle.
  await page.goto(matterUrl);
  for (const prefix of ['Research:', 'Document:']) {
    const option = page.locator('select[name="target"] option', { hasText: prefix }).first();
    await page.locator('select[name="target"]').selectOption(await option.getAttribute('value'));
    await page.getByRole('button', { name: 'Link' }).click();
    // Once linked, the item leaves the selector.
    await page.waitForFunction(
      (p) =>
        ![...document.querySelectorAll('select[name="target"] option')].some((o) =>
          o.textContent.startsWith(p),
        ),
      prefix,
    );
  }
  await page.getByRole('link', { name: 'Memo on dismissal' }).waitFor();
  const [bundle] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Export case bundle/ }).click(),
  ]);
  assert.match(bundle.suggestedFilename(), /^M-\d{4}-0001-case-bundle\.zip$/);
  assert.equal(
    readFileSync(await bundle.path())
      .subarray(0, 2)
      .toString('latin1'),
    'PK',
    'a ZIP archive',
  );
  assert.ok(researchUrl);
  assert.deepEqual(errors, [], 'no client-side errors');
});

test('journey 15.2: firm conflict check gates matter opening; barrier and team through the UI', async () => {
  const partner = await createUser('partner');
  const { page, errors } = await signedIn(partner);
  const { data: session } = await createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  ).auth.signInWithPassword({ email: partner.email, password: PASSWORD });
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
  });
  const slug = `journey-firm-${stamp}`;
  await client
    .from('organizations')
    .insert({ name: 'Journey Advokatfirma', slug, kind: 'law_firm' });
  const { data: org } = await client.from('organizations').select('id').eq('slug', slug).single();
  await client
    .from('workspaces')
    .insert({ organization_id: org.id, name: 'Tvist', slug: `${slug}-ws`, kind: 'team' });
  const { data: ws } = await client
    .from('workspaces')
    .select('id')
    .eq('slug', `${slug}-ws`)
    .single();

  // Without a check the intake form demands one.
  await page.goto(`${BASE}/matters/new?org=${org.id}&ws=${ws.id}&category=contract`);
  assert.ok(await page.getByText('No usable check: run one first').count());

  // Register the client, run and clear a conflict check.
  await page.goto(`${BASE}/professional?org=${org.id}`);
  await page.getByLabel('Name', { exact: true }).fill('Nordic Retail AS');
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.getByRole('button', { name: 'Register client' }).click(),
  ]);
  await page.getByLabel('Subject').fill('Claim against Supplier Ltd');
  await page.getByLabel(/Names to check/).fill('Supplier Ltd');
  await page.getByLabel('For workspace').selectOption({ label: 'Tvist' });
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.getByRole('button', { name: 'Run check' }).click(),
  ]);
  await page.getByText(/pending · 0 hits/).waitFor();
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.getByRole('button', { name: 'Clear' }).click(),
  ]);
  await page.getByText(/clear · 0 hits/).waitFor();

  // Open the matter with the cleared check and the client.
  await page.goto(`${BASE}/matters/new?org=${org.id}&ws=${ws.id}&category=contract`);
  await page.getByLabel(/Conflict check/).selectOption({ index: 1 });
  await page.getByLabel('Client').selectOption({ label: 'Nordic Retail AS' });
  await page.getByLabel(/Matter title/).fill('Nordic Retail v Supplier');
  await page.getByLabel('Who is the other contracting party?').fill('Supplier Ltd');
  await page.getByLabel(/What happened\?/).fill('Goods were delivered late and defective.');
  await page.getByLabel('When did the main event happen?').fill('2026-09-01');
  await page.getByLabel('What outcome do you want?').fill('damages');
  await Promise.all([
    page.waitForURL(/\/matters\/[0-9a-f-]{36}$/),
    page.getByRole('button', { name: 'Open matter' }).click(),
  ]);
  assert.ok(await page.getByText(/Conflict check: clear/).isVisible());
  assert.ok(await page.getByText('Client: Nordic Retail AS', { exact: false }).isVisible());

  // The partner assigns themself as responsible lawyer.
  await page
    .locator('form:has(button:text("Assign")) select[name="principalId"]')
    .selectOption({ index: 0 });
  await page
    .locator('form:has(button:text("Assign")) select[name="role"]')
    .selectOption('responsible_lawyer');
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.getByRole('button', { name: 'Assign' }).click(),
  ]);
  assert.ok(await page.getByText('responsible lawyer').first().isVisible());

  // A reused check is refused.
  await page.goto(`${BASE}/matters/new?org=${org.id}&ws=${ws.id}&category=contract`);
  assert.ok(
    await page.getByText('No usable check: run one first').count(),
    'a used check cannot open a second matter',
  );
  assert.deepEqual(errors, []);
});

test('localisation and accessibility basics', async () => {
  const user = await createUser('locale');
  const { page, context } = await signedIn(user);
  sql(
    `update public.user_profiles set locale = 'nb-NO' where principal_id = (select principal_id from private.principal_identities where auth_user_id = '${user.id}')`,
  );
  await page.goto(`${BASE}/dashboard`);
  assert.ok(
    await page.getByText('Rettskildesøk').first().isVisible(),
    'navigation follows the profile language',
  );
  for (const path of [
    '/dashboard',
    '/matters',
    '/research',
    '/documents',
    '/jurisdictions',
    '/billing',
  ]) {
    await page.goto(`${BASE}${path}`);
    assert.equal(await page.locator('h1').count(), 1, `${path} has one main heading`);
    const unlabeled = await page
      .locator('input:not([type=hidden]):not([type=checkbox]), select, textarea')
      .evaluateAll(
        (elements) =>
          elements.filter(
            (el) =>
              !el.closest('label') &&
              !el.getAttribute('aria-label') &&
              !(el.id && document.querySelector(`label[for="${el.id}"]`)) &&
              !el.getAttribute('placeholder'),
          ).length,
      );
    assert.equal(unlabeled, 0, `${path}: every form field has a label`);
  }
  await context.close();
});

test('journey GLCI: the Global Legal Observatory and its command centre (operators only)', async () => {
  const customer = await createUser('glci-customer');
  const operator = await createUser('glci-operator');
  sql(`insert into private.platform_operators (principal_id, operator_role)
    select principal_id, 'knowledge_admin' from private.principal_identities where auth_user_id = '${operator.id}' on conflict do nothing;`);

  // A customer never reaches the observatory.
  const outsider = await signedIn(customer);
  const refused = await outsider.page.goto(`${BASE}/admin/observatory`);
  assert.equal(refused?.status(), 404, 'customers get a 404 for the observatory');
  await outsider.context.close();

  const { page, errors, context } = await signedIn(operator);
  await page.goto(`${BASE}/admin`);
  await Promise.all([page.waitForURL(/\/admin\/observatory/), page.getByRole('link', { name: 'Global Legal Observatory' }).click()]);
  assert.equal(await page.locator('h1').innerText(), 'Global Legal Observatory');
  assert.ok(await page.getByText('Verified current', { exact: true }).isVisible(), 'headline figures are shown');
  assert.ok(await page.getByRole('heading', { name: 'Source availability and health' }).isVisible());
  assert.ok((await page.getByText('awaiting rights review').count()) > 0, 'sources without a lawful basis say so');
  // GLCI-10: the onboarding register and the platform activation checklist.
  const register = page.locator('section[aria-label="Onboarding register"]');
  assert.ok(await register.getByText(/next: Activate a lawful target/).first().isVisible(), 'Norway\'s next onboarding step is shown');
  assert.ok((await register.getByText(/next \(owner\): Review the source terms/).count()) > 0, 'owner steps are marked');
  assert.ok(await register.getByText(/not configured.*ANTHROPIC_API_KEY/).isVisible(), 'secrets are reported as present or absent, never shown');

  // Spec §5 example 4: coverage report from live data.
  await page.getByLabel('Question').fill('Check whether our European legal coverage is current.');
  await Promise.all([page.waitForURL(/conversation=/), page.getByRole('button', { name: 'Ask' }).click()]);
  await page.getByText(/Coverage report \(\d+ jurisdiction/).waitFor();
  assert.ok(await page.getByText(/NO: not monitored/).first().isVisible(), 'Norway is reported as not monitored, never as current');
  // GLCI-08: the default engine is Claude Code with fallback. Neither Claude Code nor the API is
  // configured here, so the answer comes from the rules engine and says which engines were skipped.
  assert.ok(await page.getByText('via Rules engine').first().isVisible(), 'the answering engine is named');
  assert.ok(await page.getByText(/Claude Code \(your subscription\) skipped \(claude code not configured\)/).first().isVisible(),
    'the fallback is visible');
  assert.ok(await page.getByLabel('Engine', { exact: true }).isVisible(), 'an engine can be chosen per question');

  // Spec §5 example 3: a connector change becomes an engineering request awaiting a second operator.
  await page.getByLabel('Question').fill('Update the Norwegian legal ingestion connector to support the latest official source format.');
  await Promise.all([page.waitForLoadState('networkidle'), page.getByRole('button', { name: 'Ask' }).click()]);
  await page.getByText(/opened an engineering request for NO/).waitFor();
  assert.ok((await page.getByText(/engineering task · proposed by operator · proposed/).count()) > 0, 'the request waits in the approval queue');
  assert.equal(await page.getByText('You', { exact: true }).count(), 2, 'the conversation keeps both questions');

  // GLCI-11: monitoring activation goes through an approval request.
  const lovdata = page.locator('li', { hasText: 'Lovdata API — current laws' }).first();
  await lovdata.getByPlaceholder('Reason to start monitoring').fill('Reference jurisdiction: monitor the NLOD dataset');
  await Promise.all([page.waitForURL(/done=request-activation/), lovdata.getByRole('button', { name: 'Request monitoring' }).click()]);
  const pendingApproval = page.locator('section[aria-label="Governance"] li', { hasText: 'no-lovdata-current-laws' }).first();
  await pendingApproval.getByPlaceholder('Decision note').fill('Approving my own activation');
  await Promise.all([page.waitForURL(/error=/), pendingApproval.getByRole('button', { name: 'Approve' }).click()]);
  assert.ok(await page.getByText(/glci four eyes required/).isVisible(), 'the requester cannot approve their own activation');

  // The requester cannot approve their own task (four eyes).
  const queueItem = page.locator('li', { hasText: 'engineering task · proposed by operator' }).first();
  await queueItem.getByPlaceholder('Decision note').fill('Approving my own request');
  await Promise.all([page.waitForURL(/error=/), queueItem.getByRole('button', { name: 'Approve' }).click()]);
  assert.ok(await page.getByText(/glci four eyes required/).isVisible(), 'self-approval is refused');
  assert.deepEqual(errors, [], 'no client-side errors');
  await context.close();

  // GLCI-09: a second operator approves and executes; the task is handed to an executor. None is
  // configured here, so the hand-off is recorded as failed with its reason and can be retried.
  const second = await createUser('glci-approver');
  sql(`insert into private.platform_operators (principal_id, operator_role)
    select principal_id, 'knowledge_admin' from private.principal_identities where auth_user_id = '${second.id}' on conflict do nothing;`);
  const approver = await signedIn(second);
  await approver.page.goto(`${BASE}/admin/observatory`);
  const item = approver.page.locator('li', { hasText: 'engineering task · proposed by operator' }).first();
  await item.getByPlaceholder('Decision note').fill('Second operator approves the connector change');
  await Promise.all([approver.page.waitForURL(/done=approve/), item.getByRole('button', { name: 'Approve' }).click()]);
  const approved = approver.page.locator('li', { hasText: 'engineering task · proposed by operator · approved' }).first();
  await Promise.all([approver.page.waitForURL(/done=execute/), approved.getByRole('button', { name: 'Execute approved action' }).click()]);
  const history = approver.page.locator('section[aria-label="Claude Code execution history"]');
  await history.getByText(/glci\/task-[0-9a-f]{8}/).waitFor();
  assert.ok(await history.getByText(/no executor configured/).isVisible(), 'the failed hand-off says why');
  assert.ok(await history.getByRole('button', { name: 'Send to Claude Code again' }).isVisible(), 'and can be retried');
  // GLCI-11: the second operator approves the monitoring activation and downloads the audit export.
  const activation = approver.page.locator('section[aria-label="Governance"] li', { hasText: 'no-lovdata-current-laws' }).first();
  await activation.getByPlaceholder('Decision note').fill('Second operator approves Lovdata monitoring');
  await Promise.all([approver.page.waitForURL(/done=approve-action/), activation.getByRole('button', { name: 'Approve' }).click()]);
  const source = approver.page.locator('section[aria-label="Source availability and health"] li', { hasText: 'Lovdata API — current laws' }).first();
  assert.ok(await source.getByText('not checked').isVisible(), 'the approved source is monitored, and reads "not checked" until a check succeeds');
  const [download] = await Promise.all([approver.page.waitForEvent('download'), approver.page.getByRole('link', { name: 'Download the verified audit export' }).click()]);
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
  assert.equal(exported.format, 'njumeni-glci-audit-export-1');
  assert.equal(exported.integrity.chainValid, true, 'the exported audit chain verifies');
  assert.ok(exported.events.some((e) => e.eventType === 'governance.approved'), 'the approval is in the audit export');
  // GLCI-12: a recovery drill runs against production functions and rolls back.
  const continuous = approver.page.locator('section[aria-label="Continuous monitoring"]');
  await Promise.all([approver.page.waitForURL(/done=drill/), continuous.getByRole('button', { name: 'Run recovery drill' }).click()]);
  assert.ok(await continuous.getByText('passed', { exact: true }).isVisible(), 'the recovery drill passes');
  assert.ok(await continuous.getByText(/source outage — /).isVisible(), 'and lists its scenarios');
  assert.deepEqual(approver.errors, [], 'no client-side errors');
  await approver.context.close();
});

test('journey homepage: public homepage, every link and anchor, demonstration, early access', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(`${BASE}/`);
  assert.equal(response.status(), 200, 'the homepage is public (no redirect to sign-in)');
  assert.equal(await page.locator('h1').count(), 1, 'one main heading');
  assert.match(await page.locator('h1').innerText(), /Know the law\.\s*Understand its authority\.\s*Stay ahead of change\./);
  assert.match(await page.title(), /Njumeni/);
  assert.ok(await page.locator('meta[name="description"]').getAttribute('content'), 'meta description');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'index, follow', 'the homepage is indexable');
  assert.ok(await page.getByText('Njumeni is opening to early-access organisations, starting with Norway.').isVisible(), 'early-access notice');
  // The story: the thirteen sections in order (sections with an anchor).
  for (const id of ['research', 'workspace', 'evidence', 'change-intelligence', 'international', 'organisations', 'ai', 'trust', 'audiences', 'plans']) {
    assert.equal(await page.locator(`section#${id}`).count(), 1, `section ${id}`);
  }
  // The research view: the real held version answers; an earlier date gets the temporal refusal.
  const rv = page.locator('.nj-stage');
  assert.ok(await rv.getByText('In force from 1 July 2026').isVisible(), 'the version held is shown');
  assert.ok(await rv.getByText(/Arbeidstaker kan ikke sies opp uten at det er saklig begrunnet/).isVisible(), 'the quotation of § 15-7 (1)');
  await rv.getByRole('button', { name: 'Law as at 15 Jan 2025' }).click();
  assert.ok(await rv.getByText(/not the\s+version in force on 15 January 2025/).isVisible(), 'no version held for that date: Njumeni declines');
  await rv.getByRole('button', { name: 'Law as at 1 Aug 2026' }).click();
  assert.ok(await rv.getByText('In force from 1 July 2026').isVisible());
  // The research demonstration: real text for Norway; declines where no text or version is held.
  const run = page.locator('.nj-demo2');
  assert.ok(await run.getByText('Cited finding', { exact: true }).isVisible(), 'Norway, current date: a cited finding');
  await run.getByRole('button', { name: /Sweden/ }).click();
  assert.ok(await run.getByText('Declined · no legal text held').isVisible(), 'Sweden: no text held, declined');
  await run.getByRole('button', { name: /Norway/ }).click();
  await run.getByRole('button', { name: '15 Jan 2025' }).click();
  assert.ok(await run.getByText('Declined · version not held').isVisible(), 'an earlier date: declined');
  // Evidence pipeline, custody records, environments, access check and AI governance.
  await page.locator('.nj-pipe').getByRole('button', { name: /Scan/ }).click();
  assert.ok(await page.locator('.nj-pipe').getByText(/not yet connected/).isVisible(), 'the scan step states what is not built');
  await page.locator('.nj-cus-toggle').first().click();
  assert.ok(await page.locator('.nj-cus-full').isVisible(), 'a custody record expands');
  await page.locator('.nj-envs').getByRole('button', { name: /Institutional/ }).click();
  assert.ok(await page.getByText('A public body with formal accountability.').isVisible());
  const access = page.locator('.nj-access');
  await access.getByRole('button', { name: /K\. Dahl/ }).click();
  await access.getByRole('button', { name: /Audit records/ }).click();
  assert.equal(await access.locator('.nj-access-verdict').innerText(), 'Allowed', 'the access check follows the permission');
  await page.locator('.nj-gov').getByRole('button', { name: /Recorded decision/ }).click();
  assert.ok(await page.locator('.nj-gov').getByText(/append-only/).isVisible());
  // The case file: tabs switch with the mouse and the keyboard.
  const caseFile = page.locator('.nj-cf');
  await caseFile.getByRole('tab', { name: /Chronology/ }).click();
  assert.ok(await caseFile.getByText('Notice of dismissal').isVisible());
  await page.keyboard.press('ArrowDown');
  assert.equal(await caseFile.getByRole('tab', { name: /Arguments/ }).getAttribute('aria-selected'), 'true', 'arrow keys move between tabs');
  // Accuracy: status labels, no inflated claims, no live-coverage claim, no prices.
  const text = await page.locator('main').innerText();
  assert.ok(!/\b2[0-9]\+? jurisdictions\b/i.test(text), 'no inflated jurisdiction count');
  assert.ok(text.includes('17 legal systems'), 'the framework size is stated accurately');
  assert.equal(await page.locator('.nj-board tbody tr').count(), await page.locator('.nj-board tbody td', { hasText: 'Not monitored' }).count(), 'currency today is stated: every jurisdiction not monitored');
  assert.ok(await page.locator('.nj-tag--awaiting').count() >= 3, 'capabilities awaiting activation are labelled');
  assert.ok(!/certified|ISO 27001|SOC 2/i.test(text.replace(/has not yet completed an independent penetration test or a security\s+certification/, '')), 'no certification claimed');
  assert.ok(await page.locator('.nj-atlas-map img').evaluate((img) => img.complete || img.loading === 'lazy'), 'jurisdiction map present');
  // Customer journeys: four categories with their workspaces (Master Plan §2.4).
  const journeys = page.locator('#audiences');
  for (const [tab, ws] of [['Individuals', 'Personal workspace'], ['Legal professionals', 'Professional workspace'], ['Law firms and enterprises', 'Enterprise and Law Firm workspace'], ['Public institutions', 'Institutional workspace']]) {
    await journeys.getByRole('tab', { name: new RegExp(tab) }).click();
    assert.ok(await journeys.getByText(ws, { exact: true }).isVisible(), ws);
  }
  // Plans: the eight configured plans with their allowances, no prices (Master Plan §17.1).
  const plans = page.locator('#plans');
  assert.equal(await plans.locator('.nj-tier-plans > li').count(), 8, 'eight plans in the audience tracks');
  await plans.getByRole('button', { name: 'A firm or organisation' }).click();
  await plans.getByRole('button', { name: 'A law firm' }).click();
  assert.ok(await plans.locator('.nj-finder-name', { hasText: 'Law Firm' }).isVisible(), 'the finder suggests a configured plan');
  assert.equal(await plans.locator('.nj-tier-plans > li.is-picked h4').innerText(), 'Law Firm', 'and highlights it');
  await plans.locator('summary', { hasText: 'Compare every allowance' }).click();
  let planCount = 0;
  for (const group of ['Individuals', 'Legal professionals', 'Organisations']) {
    await plans.getByRole('tab', { name: group }).click();
    planCount += await plans.locator('thead th[scope="col"]:not(:first-child)').count();
  }
  assert.equal(planCount, 8, 'eight plans across the three groups');
  assert.ok(await plans.getByText('20,000').first().isVisible(), 'allowances from the configuration');
  await plans.getByRole('tab', { name: 'Individuals' }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await plans.getByRole('tab', { name: 'Legal professionals' }).getAttribute('aria-selected'), 'true', 'arrow keys move between plan groups');
  assert.ok(!/[$€£]\s?\d/.test(await plans.innerText()), 'no undecided prices are published');
  // Every link resolves: internal pages return 200 and every in-page anchor exists.
  const hrefs = [...new Set(await page.locator('a[href]').evaluateAll((links) => links.map((a) => a.getAttribute('href'))))];
  for (const href of hrefs) {
    const url = new URL(href, `${BASE}/`);
    if (url.hash && url.pathname === '/') {
      assert.equal(await page.locator(url.hash).count(), 1, `anchor ${url.hash} exists`);
      continue;
    }
    const res = await page.request.get(url.toString(), { maxRedirects: 0 });
    assert.equal(res.status(), 200, `${href} returns 200`);
  }
  // The change-intelligence demonstration steps through the workflow.
  const demo = page.locator('.nj-obs');
  await demo.getByRole('button', { name: '03 Compare' }).click();
  await demo.getByRole('button', { name: 'Previous version' }).click();
  assert.ok(await demo.getByText('in force until 30 June').isVisible(), 'versions can be compared');
  await demo.getByRole('button', { name: '06 Affected work' }).click();
  assert.ok(await demo.locator('.nj-cons-status', { hasText: 'Found' }).first().isVisible(), 'consequences are listed');
  assert.ok(await demo.getByText('4 quote the previous wording').isVisible());
  await demo.getByRole('button', { name: 'Next stage' }).click();
  assert.ok(await demo.getByText('A remediation proposal').isVisible(), 'a remediation is proposed');
  await demo.getByRole('button', { name: 'Next stage' }).click();
  await demo.getByRole('button', { name: 'Next stage' }).click();
  assert.ok(await demo.getByText('The law has changed since this answer', { exact: true }).isVisible(), 'customers are told');
  await demo.getByRole('button', { name: 'Next stage' }).click();
  assert.ok(await demo.getByText('Legal currency is restored').isVisible(), 'the walkthrough ends with verified currency');
  assert.ok(await demo.getByRole('button', { name: 'Next stage' }).isDisabled());
  assert.ok(await page.getByText('Actual status — not illustrative').isVisible(), 'the real status is marked apart from the illustration');
  // Keyboard: on a fresh load, the skip link is the first focusable element.
  await page.goto(`${BASE}/`);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Skip to content');
  // SEO files.
  assert.match(await (await page.request.get(`${BASE}/robots.txt`)).text(), /Disallow: \//);
  assert.match(await (await page.request.get(`${BASE}/sitemap.xml`)).text(), /early-access/);

  // Early access: the call to action leads to a working form; the request is stored once.
  await Promise.all([page.waitForURL(/\/early-access$/), page.locator('.nj-hero').getByRole('link', { name: 'Request early access' }).click()]);
  const email = `homepage-${stamp}@example.invalid`;
  await page.getByLabel('Full name').fill('Early Access Journey');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Organisation').fill('Journey Law AS');
  await page.getByLabel('I am').selectOption('law_firm');
  await page.getByLabel('Norway').check();
  await page.getByLabel(/I agree that Njumeni stores this request/).check();
  await Promise.all([page.waitForURL(/status=received/), page.getByRole('button', { name: 'Request early access' }).click()]);
  assert.ok(await page.getByText('Thank you — your request has been received.').isVisible());
  assert.equal(sql(`select audience || '/' || array_to_string(jurisdictions, ',') from private.early_access_requests where email = '${email}'`), 'law_firm/NO');
  // A bot filling the hidden field is told the same and nothing is stored.
  await page.goto(`${BASE}/early-access?interest=demonstration`);
  assert.ok(await page.getByRole('heading', { name: 'Request a demonstration.' }).isVisible());
  await page.getByLabel('Full name').fill('Bot');
  await page.getByLabel('Work email').fill(`bot-${stamp}@example.invalid`);
  await page.getByLabel('I am').selectOption('individual');
  await page.getByLabel(/I agree/).check();
  await page.locator('input[name="website"]').fill('https://spam.example');
  await Promise.all([page.waitForURL(/status=received/), page.getByRole('button', { name: 'Request a demonstration' }).click()]);
  assert.equal(sql(`select count(*) from private.early_access_requests where email = 'bot-${stamp}@example.invalid'`), '0');

  // Mobile: the menu opens and the page does not scroll sideways.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const phone = await mobile.newPage();
  await phone.goto(`${BASE}/`);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0, 'no horizontal scroll on mobile');
  await phone.getByText('Menu').click();
  assert.ok(await phone.getByRole('navigation', { name: 'Main (mobile)' }).getByRole('link', { name: 'Request early access' }).isVisible());
  assert.deepEqual(errors, [], 'no client-side errors');
  await browser.close();
});
