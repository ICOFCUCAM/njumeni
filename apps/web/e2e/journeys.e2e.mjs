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
  assert.ok(await page.getByText('Verified current').isVisible(), 'headline figures are shown');
  assert.ok(await page.getByRole('heading', { name: 'Source availability and health' }).isVisible());
  assert.ok((await page.getByText('awaiting rights review').count()) > 0, 'sources without a lawful basis say so');

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
  assert.deepEqual(approver.errors, [], 'no client-side errors');
  await approver.context.close();
});
