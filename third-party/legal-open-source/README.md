# Njumeni legal technology source register

These projects are made available as separate upstream Git checkouts for local engineering research. The bootstrap script clones them without rewriting their source or history.

| Project | Upstream | Useful research areas | Licence review |
|---|---|---|---|
| OpenContracts | https://github.com/Open-Source-Legal/OpenContracts | Document intelligence, annotations, extraction, citation graphs, API and MCP integration | MIT (upstream LICENSE checked) |
| CaseCite | https://github.com/thomasunise/casecite | Self-hosted legal RAG, case and judge research, document corpus and BYOK AI | Apache-2.0 (upstream LICENSE checked) |
| Lawgent | https://github.com/heyutkarshverma/Lawgent | Legal document Q&A, summarisation and translation; Next.js/Gemini implementation patterns | No LICENSE file found in initial check; treat as all-rights-reserved until clarified |
| Lovspor | https://github.com/bartoszkobylinski/lovspor | Norwegian legislation corpus, legal citation verification, version history and MCP tools | AGPL-3.0 (upstream LICENSE checked); assess network-use obligations before integration |
| Mike | https://github.com/open-legal-products/mike | Legal document review and drafting, matters, citation verification, research workflows and Word integration | AGPL-3.0 (upstream LICENSE checked); assess network-use obligations before integration |

## Local directory layout

```
third-party/legal-open-source/
  OpenContracts/
  CaseCite/
  Lawgent/
  Lovspor/
  Mike/
```

## Developer workflow

1. From the Njumeni repository root, run `bash scripts/bootstrap-legal-sources.sh`.
2. Inspect the README, licence, dependency manifests, security model and architecture of each checkout.
3. Use these repositories as reference implementations; do not import them wholesale into Njumeni's production build.
4. Extract and adapt only components that fit Njumeni's architecture, after technical and licence review.
5. For every adopted component, record upstream URL, exact commit SHA, licence, modifications, required notices and the Njumeni module that uses it.
6. Keep each upstream checkout separate. Do not edit upstream code in place as part of ordinary Njumeni development.

## Updating upstream copies

Each checkout has an `upstream` remote. Enter the project directory, inspect incoming changes, and update deliberately. Do not auto-update production code from upstream.

Example:

```bash
cd third-party/legal-open-source/OpenContracts
git remote -v
git fetch upstream
git log --oneline HEAD..upstream/main
```
