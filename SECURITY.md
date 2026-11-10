# Security policy

## Product and repository boundary
Njumeni is a legal technology application. Handling confidential legal information is an intended product capability, not something the product is prohibited from doing. The application is expected to support secure document intake, storage, matter/case management, evidence handling, controlled access, processing and retrieval, subject to the classification level, applicable law, customer requirements and hosting authorisations.

This Git repository has a different purpose: it contains Njumeni's application source code, tests, deployment configuration and engineering documentation. It must not be combined with unrelated products or codebases (including the legacy CMP project), and it must not be used as the production repository for customer matter files or live case data.

## Protecting application data
Confidential and classified legal material must be handled by the running Njumeni application through its dedicated data and storage architecture, not committed to source control. The implementation must define and enforce, as appropriate to the data classification and hosting approval:
- tenant and matter-level isolation;
- role- and attribute-based access controls and least privilege;
- encryption in transit and at rest, with managed key access;
- immutable or tamper-evident audit trails for access and material actions;
- secure upload, malware inspection, document processing and controlled downloads;
- retention, legal hold, export and verified deletion policies;
- backup, disaster recovery, incident response and data residency controls;
- restrictions on AI/model access, training use, subprocessors and cross-border transfers.

For officially classified information, the hosting environment and service providers must be expressly authorised for the relevant classification. A private GitHub repository, ordinary cloud storage or encryption alone does not establish that authorisation.

## Source-control hygiene
- Keep this repository dedicated to Njumeni; maintain unrelated products in separate repositories.
- Never commit live customer documents, case files, evidence, production database dumps, backups, credentials, API keys, private keys, access tokens or production configuration.
- Use synthetic or properly anonymised fixtures for tests and examples.
- Use .env.example with placeholders only. Never commit real environment files.
- Use ignore rules and CI checks as guardrails, not as a substitute for review.
- Do not put sensitive data in issue descriptions, pull requests, commit messages or CI logs.
- Review dependencies and third-party code before adoption; preserve licence obligations and clear product boundaries.

If sensitive information is committed, treat it as exposed: revoke/rotate credentials immediately, restrict access, investigate exposure, and follow the organisation's incident-response and legal-notification procedures. Deleting a file in a later commit does not remove it from Git history or existing clones.

## Reporting
Report suspected exposure privately to the repository owner/security contact. Do not open a public issue containing the sensitive material.
