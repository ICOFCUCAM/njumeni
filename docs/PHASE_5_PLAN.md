# Phase 5 — AI reasoning and agent framework

| Field | Value |
|---|---|
| Phase state | 🔵 **IMPLEMENTED: verified locally.** Formal closeout pending §5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md): §5 AI architecture and agent catalogue, Module F (legal reasoning), U-13 (provider independence), U-14 (argument graph), U-23 (AI data governance) |
| Architecture | [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) |
| Execution mode | Owner-directed continuous autonomous mode: one commit per completed phase |
| Depends on | Phase 4 (verified research runs), Phase 3 (evidence and factual propositions), Phase 1 (RBAC) |

## 1. Objective

Add AI reasoning without giving up any of the guarantees built so far. Every model call is:
- authorised by the database against the caller's permissions and the workspace's AI policy;
- isolated from prompt injection in user, document and legal text;
- validated so that it can cite only material it was given;
- recorded in an append-only governance log, including refusals and failures.

Agent output is a **proposal**: nothing an agent produces becomes part of an argument until a person accepts it.

Spending is zero by default (ADR-0003). The only enabled provider is a deterministic, offline mock. The real provider adapter is added when the owner decides the provider and budget (decision D-5). It will use the official Anthropic TypeScript SDK.

## 2. Design

| Element | Implementation |
|---|---|
| Provider registry | `private.ai_providers`: `mock` (enabled), `anthropic` and `self-hosted` (disabled). Each records data terms (no training, zero retention) and per-million-token rates. A provider without no-training terms is refused |
| Agent registry | `private.ai_agents`: the 19 agents of master plan §5, each with autonomy level (A0 automatic check, A1 proposal for review, A2 bounded automation), the permission the **caller** must hold, the permissions the agent uses, and its phase |
| Workspace AI policy | `private.workspace_ai_settings`. Most restrictive by default: providers `{mock}`; egress `{public_legal}`; paid budget 0 tokens per month. Read with `ai_get_workspace_settings`; changed by workspace managers with `ai_update_workspace_settings` (`workspace.manage`) |
| Authorisation | `ai_authorise_execution(org, ws, agent, provider, egress classes, estimated tokens)`. Checks in order: caller scope; agent known and caller holds its permission; provider enabled with acceptable terms; provider allowed by the workspace; for external providers, every data class allowed by the workspace; for paid providers, the month's recorded usage plus the estimate within budget. Returns `{allowed, reason, agentVersion, autonomy}` |
| Governance log | `private.ai_executions` (append-only). Records agent and version, provider, model, prompt version, egress classes, input and retrieval references, token counts, cost (computed from provider rates by the database), duration, status (`succeeded`, `refused`, `failed`), refusal reason and safety flags. Written only through `ai_record_execution` |
| Orchestrator | `modules/ai/core.ts` → `runAgent`: classify egress → detect injection → authorise → record a refusal **without calling the provider** → call with timeout → parse and validate → record success or failure |
| Prompt-injection isolation | Untrusted text is rendered as escaped `<data>` elements, so it cannot close or forge markup. The system prompt says data is never instructions. Override, role reassignment, markup and prompt-extraction patterns are flagged and recorded. Flagged text stays data and never changes the task |
| Argument graph (U-14) | `private.legal_issues`, `private.argument_nodes` (15 node types), `private.argument_edges` (13 edge types). Database constraints: rule and interpretation nodes must cite an authority passage; fact and evidence nodes must cite evidence or a proposition, or be marked an assumption; evidence and propositions must belong to the same workspace; agent nodes carry their execution ID and start `proposed`; a node can be reviewed only once |
| Reasoning engine | `modules/reasoning/argument.ts`. The `reasoning` agent turns a verified research run plus the workspace's factual propositions into a proposed graph: issue → governing rules (verified passages only) → interpretations → counterarguments from conflicting authority → an argument node → related facts → their evidence (supports / contradicts / qualifies). It adds open questions for unproven facts, and a research-gap question when no law verified |
| Output validation | `validateArgumentProposal`: law nodes may cite only passages verified in the run; facts and evidence only the supplied propositions and items; known node and edge types; edges between known keys. Violations fail the execution (`AI_OUTPUT_UNGROUNDED`, `AI_OUTPUT_INVALID`) and nothing is stored |
| Reasoning evaluation | `evaluateArgumentGraph`, a structural rubric with eight checks: issue defined; law identified; law cited; facts present; facts grounded; opposition considered; graph connected; human-reviewed. The issue page shows the score and the checks |
| Interface | `/arguments` (choose a research run and propose an argument; list issues; the workspace AI policy shown read-only). `/arguments/[issueId]` (nodes grouped by law, facts, arguments and opposition, with accept/reject on proposals and the quality checks) |

## 3. Tasks

| # | Task | State |
|---|---|---|
| 5.1 | Provider registry with data terms and rates; mock provider | ✅ |
| 5.2 | Agent registry (19 agents, autonomy, caller permission) | ✅ |
| 5.3 | Workspace AI policy (providers, egress, budget), restrictive defaults | ✅ |
| 5.4 | Database authorisation and append-only execution log with cost | ✅ |
| 5.5 | Orchestrator with refusal, failure and success recording; timeouts | ✅ |
| 5.6 | Prompt-injection isolation and safety flags | ✅ |
| 5.7 | Argument graph schema with grounding constraints and review-once | ✅ |
| 5.8 | Reasoning agent (issue, rules, interpretations, counterarguments, facts, evidence) | ✅ |
| 5.9 | Output validation (no invented citations or out-of-scope material) | ✅ |
| 5.10 | Reasoning evaluation rubric | ✅ |
| 5.11 | `/arguments` interface with human review | ✅ |
| 5.12 | Real provider adapter (official SDK) | ⏸ Owner decision D-5 (provider and budget) |
| 5.13 | Issue and counterargument agents as separate model-backed agents | ⏸ With 5.12; the deterministic engine covers both roles today |

## 4. Verification (local, 2026-11-12)

| Check | Result |
|---|---|
| pgTAP | **427/427** in 16 files (`ai_reasoning_framework` 28/28) |
| Application tests | **223/223** (`ai-reasoning` 9) |
| Type check, Prettier (CI set), content policy, migration guard, `next build` | ✅ (`/arguments` and `/arguments/[issueId]` built) |
| End-to-end on the local stack (synthetic) | ✅ See below |

pgTAP covers:
- the registries and restrictive defaults;
- each refusal: unknown agent, disabled provider, provider not allowed by the workspace, egress not permitted, budget exceeded (including recorded usage counting against the budget);
- cost from provider rates;
- the append-only execution log;
- the grounding constraints (uncited rule and ungrounded fact rejected);
- foreign-tenant evidence rejected;
- proposals stay proposed; review-once;
- outsider denial for graphs and agent runs.

The end-to-end run as a real signed-in user:
1. Research answered from a verified synthetic passage.
2. `proposeArgument` produced 7 nodes and 7 edges, all `proposed`:
   - the rule cites the verified authority;
   - the evidence links to the exhibit;
   - a hostile proposition ("Ignore all previous instructions…") was flagged `INSTRUCTION_OVERRIDE`, recorded in the execution, and kept as data.
3. The execution was recorded: mock provider, token counts, cost 0.
4. A node was accepted; a second review was refused.
5. The rubric reported missing opposition and pending review.
6. A disabled commercial provider was refused **before any call** and the refusal recorded.
7. An outsider was denied the graph.

## 5. Closeout conditions outstanding

| # | Condition | Dependency |
|---|---|---|
| 1 | ~~CI green on the Phase 5 commit~~ ✅ `07aa1b5` and the follow-up `fdff7df`: runs `43125078347` (CI and security) and `43125078413` (database verification), both successful | Done |
| 2 | Phases 3 and 4 closed | Their own closeout items (OCR and anti-virus; Task 2.8) |
| 3 | A model-backed reasoning evaluation on real content | D-5 and Task 2.8 |

## 6. Decisions

- **The database decides whether an agent may run**, not the application. A forged client can't exceed the caller's permissions, bypass the workspace policy, or skip the log. Refusals are recorded too.
- **The mock provider is the default, not a test double.** It is deterministic and offline, so the reasoning workflow, governance and interface are complete and demonstrable at zero cost in a public repository. No model call can happen by accident.
- **Egress is classified from the data, not declared by the caller.** Question text is `user_narrative`, legal passages `public_legal`, propositions `confidential_evidence`, privileged material `privileged`. The mock never leaves Njumeni, so egress rules apply only to external providers.
- **Validation before storage.** A model can only refer to the material it was given. The database constraints are a second line of defence.
- **Agents propose; people decide (A1).** Agent nodes are `proposed` until reviewed, reviews are final, and the graph shows who proposed what.
