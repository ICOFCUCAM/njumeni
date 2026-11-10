# Repository hygiene and unresolved-risk review

- **Task:** Phase 0.15 — full repository hygiene checks and unresolved-risk review
- **Review date:** 10 November 2026
- **Repository:** `ICOFCUCAM/njumeni`
- **Branch reviewed:** `claude/wonderful-franklin-lt09d7`
- **Reviewed head:** `5fe88cd90835e989006863645e4343c471bcb0a9`
- **Method:** read-only GitHub tree, branch metadata, tracked configuration, security policy, CI workflow, dependency manifest, third-party notices and infrastructure audit review. No repository settings, secrets, customer data or production resources were changed.

## 1. Executive result

The repository hygiene review found a small, source-only foundation repository with explicit protections against committing runtime customer/matter records, environment secrets and common private-key files. The tracked tree contains 85 entries and is not truncated. No runtime customer-data directories, application database dumps, private keys or real environment files appear in the reviewed tracked-file inventory. The repository content-policy job and Gitleaks job passed on the reviewed documentation commits.

**Task 0.15 is not a declaration of production security or production readiness.** The application remains a non-operational shell without authentication, tenancy, RLS, private document storage, production database, provider-egress enforcement or production deployment. Those are recorded as unresolved risks and remain phase gates.

## 2. Checks performed and evidence

| Area | Finding | Evidence / result |
|---|---|---|
| Tracked repository inventory | 85 tree entries; GitHub reported the recursive tree was not truncated. Tracked source consists of docs, application shell, CI, tests and scripts. | GitHub recursive tree for reviewed head |
| Runtime/customer data | No tracked path in the prohibited runtime/customer-data path families was found in the reviewed tree. | `scripts/security/check-repository-content.sh`; CI content-policy job passed |
| Environment and key ignores | `.gitignore` excludes real `.env` files, key/certificate formats, Terraform state, runtime data paths, build artefacts and dependencies; explicitly permits only `.env.example` among environment files. | `.gitignore` |
| Environment template | Prior foundation review found placeholder-only values and mock AI default. No live credentials were read in this hygiene review. | `.env.example`; `docs/INFRASTRUCTURE_AUDIT.md` |
| Secret scanning | Gitleaks action completed successfully on the reviewed documentation commits. | Workflow runs `42768254197` and `42768259790` |
| Content policy | Tracked-path guard completed successfully on the reviewed documentation commits. | Workflow runs `42768254197` and `42768259790` |
| Foundation quality checks | The full quality job was green for the corrected foundation commit; later scope clarification commits also passed the workflow. | Run `42767703330` success; runs `42768254197` and `42768259790` success |
| Dependency manifest | Web dependencies are exact-version pinned and a lockfile exists. | `apps/web/package.json`, `apps/web/package-lock.json` |
| Third-party reuse | Notices identify five upstream research projects and their initially observed licences; Lawgent has no licence found in the initial check. Exact commit-level review is still required before adoption. | `THIRD_PARTY_NOTICES.md`, `third-party/legal-open-source/README.md` |
| Branch protection | Reviewed working branch reports `protected: false`; branch metadata alone does not establish repository-wide rulesets or protection on another branch. | GitHub branch metadata for `claude/wonderful-franklin-lt09d7` |
| Repository visibility | Repository is public. | Existing infrastructure audit and repository metadata |
| Application trust boundary | No authentication, tenant enforcement, RLS, private storage, audit service or provider-egress control is connected. | `docs/INFRASTRUCTURE_AUDIT.md`; application health endpoint |
| Deployment and operations | No dedicated Njumeni application deployment, production database, object store, queue, worker, monitoring or backup system is verified. | `docs/INFRASTRUCTURE_AUDIT.md` |

## 3. Unresolved risks and required treatment

### P0 — public repository visibility conflicts with the original private-repository requirement

The repository is currently public, while the original product plan calls for a private application repository. Public visibility exposes source code, implementation details and future development history. No visibility change was made because it is an owner-level access decision that may affect collaborators, integrations and public references.

**Required owner action:** decide and execute the repository visibility change before confidential implementation details, partner material or sensitive deployment configuration are added. Until then, treat all commits and branches as public.

### P0 — no production security boundary

The current shell has no connected authentication, tenant resolution, matter-level authorisation, database RLS, private object storage, production audit service or controlled AI-provider egress.

**Required engineering gate:** do not accept real customer legal documents, confidential matters or production personal data in this shell. Phase 1 must establish identity, tenancy and security before sensitive workflows are enabled.

### P1 — active working branch is unprotected

The reviewed branch `claude/wonderful-franklin-lt09d7` reports `protected: false`. A stable release branch and required checks/review rules are not evidenced by this branch inspection.

**Required action:** establish a protected release/default-branch policy, required CI checks, review requirements and deployment promotion controls before production release. Repository rulesets and protections on other branches remain unverified.

### P1 — CI supply-chain hardening

The workflow uses major-version action tags (`actions/checkout@v4`, `actions/setup-node@v4`, `gitleaks/gitleaks-action@v2`) rather than immutable full commit-SHA references. Tool packages are version-pinned in the install command, but the CI setup still downloads tools at runtime. The workflow uses `--no-audit` for npm installation, so this pipeline does not currently provide a dependency vulnerability audit.

**Required action:** pin third-party GitHub Actions to verified full commit SHAs with update automation; add a separate lockfile-based dependency vulnerability/licence review appropriate to the selected dependency policy; preserve reproducible installs. Do not treat current Gitleaks success as a full software supply-chain assessment.

### P1 — upstream licence and provenance gates

The five named upstream repositories are reference projects, not the exclusive technology universe. Their licences must be checked against exact commits and all transitive dependencies before any code or data is adopted. Lawgent's initial review found no licence file; do not copy or distribute its code absent permission or a clarified licence. AGPL-3.0 obligations for Lovspor and Mike require deliberate legal review. Data/corpus licensing must be assessed separately from software licensing.

**Required action:** complete per-project capability, exact-commit, dependency, code, data and licence inventories before integration. Adoption outcomes may be adopt, adapt, reimplement, isolate, replace or discard.

### P1 — operational resilience and privacy controls absent

No Njumeni production database, private object store, key management, backup/restore test, monitoring, incident-response integration, retention/deletion enforcement or region/data-residency decision is verified.

**Required action:** provision and validate these controls in their planned phases, with explicit owner decisions for hosting, data classification, region, retention, RPO/RTO and provider terms.

## 4. Scope limits

- This was a read-only review of the connected GitHub repository and tracked source. It is not a penetration test, SAST/DAST assessment, dependency CVE audit, external attack-surface test or legal opinion.
- The GitHub read connection did not expose repository/environment secret values or all settings. No claim is made that no GitHub secrets exist.
- Passing Gitleaks establishes only that the configured scan passed; it does not prove that no secret has ever existed in all Git history, forks, logs or external systems.
- The path guard checks tracked path families; it cannot determine whether arbitrary files contain sensitive information under an innocuous filename.
- No production customer records, legal matters, secret values or other product databases were accessed.
- No owner-level repository visibility or branch-protection settings were changed.

## 5. Task 0.15 acceptance

- [x] Inspect complete tracked tree and branch metadata.
- [x] Review ignore rules, environment template policy and private-key exclusions.
- [x] Review tracked runtime/customer-data path guard.
- [x] Verify secret-scan and content-policy job outcomes on the latest documentation commits.
- [x] Review CI workflow and identify action-pinning and dependency-audit gaps.
- [x] Review third-party notices and upstream reuse/licence guardrails.
- [x] Record unresolved risks, severity, evidence, limitations and required treatment.
- [x] Preserve owner-level decisions as unresolved; do not silently change repository visibility or protection settings.
- [ ] Commit this review and register the task as green only after the review commit's CI checks pass.

**Conclusion:** repository hygiene checks are satisfactory for the current foundation repository, subject to the explicitly documented limitations and unresolved owner/security gates. This is not production readiness.