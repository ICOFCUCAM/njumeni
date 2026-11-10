# Security policy

## Data classification rule

This repository is for application source code and non-sensitive engineering documentation only.

**Never commit or upload to GitHub:**
- classified, restricted, confidential or privileged legal documents;
- client or matter files, pleadings, contracts, correspondence or evidence;
- identity documents, personal data, health data or financial records;
- document extracts, OCR text, embeddings, prompts or model outputs derived from real client files;
- production database dumps, backups, logs containing customer data or storage exports;
- credentials, API keys, private keys, access tokens or production configuration.

Git is not a document-management system. The legal application must store customer content in separately controlled private storage and process it through authenticated application services. Access must be tenant-scoped, least-privilege, audited and governed by retention and deletion controls.

## Repository controls

- Keep this repository private before placing non-public implementation details here.
- Use `.env.example` with placeholders only. Never commit real environment files.
- Use the repository's ignore rules and CI content checks. These are guardrails, not a substitute for review.
- Do not put real client documents in test fixtures. Use synthetic or properly anonymised data.
- Do not place sensitive data in issue descriptions, pull requests, commit messages or CI logs.
- Use secret scanning and review every proposed change before merging.
- If sensitive information is committed, treat it as exposed: revoke/rotate credentials immediately, restrict access, investigate exposure, and follow the organisation's incident-response and legal-notification procedures. Deleting the file in a later commit does not remove it from Git history or existing clones.

## Reporting

Report suspected exposure privately to the repository owner/security contact. Do not open a public issue containing the sensitive material.
