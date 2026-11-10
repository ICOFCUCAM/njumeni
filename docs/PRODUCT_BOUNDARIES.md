# Njumeni product boundaries and security architecture

## Canonical product
ICOFCUCAM/njumeni is the Njumeni legal technology platform. Its source repository is dedicated to Njumeni's own application code, tests, deployment configuration and engineering documentation.

Njumeni is intended to handle confidential legal information as part of its application functionality. Secure storage and management of legal documents, case files and evidence are product capabilities to be designed and implemented in the application architecture, subject to applicable classification, legal, customer and hosting requirements.

## Canonical repository map

| Repository | Purpose | Boundary |
|---|---|---|
| [ICOFCUCAM/njumeni](https://github.com/ICOFCUCAM/njumeni) | Njumeni legal application, tests, deployment configuration and engineering documentation | Canonical legal-platform source repository |
| [ICOFCUCAM/marketing-website](https://github.com/ICOFCUCAM/marketing-website) | Public Njumeni marketing website | Independent public-facing site; no legal application data, authenticated matter workflows or application runtime coupling. Repository exists separately; its implementation/deployment status must be assessed in its own workstream. |
| [ICOFCUCAM/njumeni-cmp-archive](https://github.com/ICOFCUCAM/njumeni-cmp-archive) | Historical Consent Management Platform (CMP) website and architecture snapshot | Separate private archive; not part of the Njumeni legal product. Original six-file snapshot was transferred and verified on 2026-11-10. |
| External upstream legal projects | Research references and candidate isolated adapters | Remain independent upstreams; never vendor wholesale into the Njumeni application. Any adapter or selected component requires a separate technical, security and licence decision. |

Unrelated software products must not be combined with Njumeni's source code. The legacy CMP (consent-management platform) website is separate work and is preserved in the verified archive repository: [ICOFCUCAM/njumeni-cmp-archive](https://github.com/ICOFCUCAM/njumeni-cmp-archive).

The six original CMP files are:
- README.md
- docs/ARCHITECTURE.md
- site/index.html
- site/css/main.css
- site/css/tokens.css
- site/js/main.js

They were introduced in original commit 0d9c90ff8e45477d25ed681aa6e29135b0bfbe7f. The original commit is available at https://github.com/ICOFCUCAM/njumeni/commit/0d9c90ff8e45477d25ed681aa6e29135b0bfbe7f.

The six original CMP files were copied as an immutable source snapshot from commit `0d9c90ff8e45477d25ed681aa6e29135b0bfbe7f` into the private archive repository. All six archived Git blob SHAs were compared against the source and matched exactly; the recursive archive tree was inspected. The source-only CMP files were removed from this repository only after those checks. The archive manifest records provenance and verification.

The same boundary applies to any other unrelated product: keep its code, build pipeline, deployment configuration and product documentation in its own repository unless there is a deliberate, documented architectural reason to share a library.

## Application data versus source code
The Njumeni application must be designed to securely ingest, store, organise, process, retrieve and govern confidential legal documents, case files and evidence. This is not prohibited by the product boundary.

Live customer/matter data belongs in Njumeni's dedicated application data layer and protected storage services—not in Git history, source-code commits, build artefacts, issue trackers or CI logs. The architecture must implement tenant and matter isolation, least-privilege access, encryption, auditable access, secure document processing, retention/legal hold/deletion, backups and recovery.

For officially classified information, the hosting environment and all relevant service providers must be authorised for the specific classification. Do not assume that a private repository or ordinary cloud storage is sufficient.

Use synthetic or properly anonymised fixtures in source control. Keep credentials, production secrets, live customer data and production database exports out of Git.

## Repository controls
The repository includes:
- ignore rules for local secrets and runtime/customer-data directories;
- a tracked-content policy check in CI;
- a Gitleaks CI scan;
- this policy documenting product separation and application-data security expectations.

These controls are guardrails, not a guarantee. Review changes, protect branches, and enable GitHub secret scanning and push protection where available.

## Repository visibility
At the time of the previous security review, GitHub reported this repository as public. The repository owner should set visibility according to the sensitivity of Njumeni's source code and operational security requirements before placing non-public implementation details here. Public/private repository visibility does not replace application data security controls.

## Legal AI architecture
The legal platform architecture proposal is documented in [LEGAL_AI_PLATFORM_ARCHITECTURE.md](LEGAL_AI_PLATFORM_ARCHITECTURE.md). It is a design document, not a claim that the application is already implemented.

## Upstream projects
The reviewed legal projects remain independent upstream sources and isolated research checkouts:
1. OpenContracts — MIT
2. CaseCite — Apache-2.0
3. Lawgent — no clear licence identified in the initial review; do not copy code without permission or a confirmed licence.
4. Lovspor — AGPL-3.0 engine; review corpus/data rights separately.
5. Mike — AGPL-3.0

Review exact upstream commits, dependency licences, data rights and commercial compatibility before adopting code. Reuse only deliberately selected components and preserve licence obligations; do not merge entire unrelated products into Njumeni by default.
