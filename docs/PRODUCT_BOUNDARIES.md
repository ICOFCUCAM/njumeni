# Njumeni product boundaries and security decision

## Canonical product

`ICOFCUCAM/njumeni` is the legal technology platform. It is not a CMP project repository.

## Legacy CMP separation

The original CMP website is unrelated legacy work and must be preserved in a separate repository, recommended name: `ICOFCUCAM/njumeni-cmp-archive`.

The six original files are:
- `README.md`
- `docs/ARCHITECTURE.md`
- `site/index.html`
- `site/css/main.css`
- `site/css/tokens.css`
- `site/js/main.js`

They were introduced in original commit `0d9c90ff8e45477d25ed681aa6e29135b0bfbe7f`. The original commit is available at https://github.com/ICOFCUCAM/njumeni/commit/0d9c90ff8e45477d25ed681aa6e29135b0bfbe7f.

The CMP files must be copied to the separate archive repository and verified there before any removal from this legal platform repository. Do not delete them until the archive has been created and checked. Prefer a Git-history-preserving extraction from the original commit if performed locally; otherwise record the original commit reference and clearly label the archive as a source snapshot.

## Classified and confidential document policy

This repository is for application source code and non-sensitive engineering documentation only. Never commit classified, restricted, confidential or privileged legal documents; client or matter files; pleadings; contracts; correspondence; evidence; identity, health or financial records; OCR text; embeddings; production prompts or outputs; customer database dumps; or credentials.

Customer documents must be uploaded through the legal application and stored outside Git in separately controlled private object storage. Enforce tenant isolation, least privilege, encryption, access logging, retention and deletion controls. Use synthetic or properly anonymised test fixtures only.

The repository now has:
- ignore rules for common legal document formats, secrets and private runtime-data directories;
- a tracked-content policy check in CI;
- a Gitleaks CI scan;
- a security policy documenting prohibited content and incident handling.

These controls are guardrails, not a guarantee that sensitive data cannot be committed. Review changes, protect branches, and enable GitHub secret scanning and push protection where available.

## Repository visibility

At the time of this security review, GitHub reported this repository as **public**. The repository owner must change it to private in GitHub Settings before placing non-public implementation details in it. Never store classified or customer documents in GitHub, even in a private repository.

## Legal AI architecture

The legal platform architecture proposal is documented in [LEGAL_AI_PLATFORM_ARCHITECTURE.md](LEGAL_AI_PLATFORM_ARCHITECTURE.md). It is a design document, not a claim that the application is already implemented.

## Upstream projects

The five reviewed legal projects remain independent upstream sources:
1. OpenContracts — MIT
2. CaseCite — Apache-2.0
3. Lawgent — no clear licence identified in the initial review; do not copy code without permission or a confirmed licence.
4. Lovspor — AGPL-3.0 engine; review corpus/data rights separately.
5. Mike — AGPL-3.0

Review exact upstream commits, dependency licences, data rights and commercial compatibility before adopting code.
