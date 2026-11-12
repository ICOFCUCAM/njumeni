# Njumeni — AI Architecture

| Field | Value |
|---|---|
| Status | In force from Phase 5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md) §5, U-13, U-14, U-23 |
| Phase plan | [PHASE_5_PLAN.md](PHASE_5_PLAN.md) |

## 1. Principles

1. **Provider independence (U-13).** Application code talks to a `ModelProvider` interface (`modules/ai/core.ts`). Providers are registered in the database with their data terms and rates. Changing provider is a registry and policy change, not a code change.
2. **The database governs every call.** `ai_authorise_execution` decides; `ai_record_execution` records. Neither can be bypassed from the client.
3. **Least data out (U-23).** Each request is classified into egress classes. By default a workspace allows only public legal text to reach an external provider.
4. **Untrusted text is data.** User questions, evidence and legal text are isolated in escaped `<data>` elements and scanned for injection patterns.
5. **Grounded or nothing.** Outputs are validated against the material supplied. Law must cite verified passages; facts must cite evidence or be marked assumptions.
6. **Agents propose; people decide.** Autonomy levels follow master plan §5: A0 automatic checks, A1 proposals for review, A2 bounded automation.
7. **Zero spend by default (ADR-0003).** Only the deterministic mock provider is enabled.

## 2. Execution flow

```
caller (signed-in user, own session)
  └─ runAgent(request)
       ├─ classifyEgress(data)          public_legal | user_narrative | confidential_evidence | privileged
       ├─ detectInjection(data)         safety flags
       ├─ ai_authorise_execution  ──►   scope · agent permission · provider enabled + terms
       │                                · workspace consent · egress (external) · budget (paid)
       ├─ refused? → ai_record_execution(status=refused) → AgentRefusedError   (provider never called)
       ├─ provider.complete(system + isolated data)   timeout
       ├─ parse + validate (grounding)
       └─ ai_record_execution(status=succeeded|failed, tokens, cost, flags)
```

## 3. Data classes

| Class | Source | Default |
|---|---|---|
| `public_legal` | Rights-approved legal passages | Allowed to external providers |
| `user_narrative` | The user's question or narrative | Not allowed until the workspace opts in |
| `confidential_evidence` | Evidence and factual propositions | Not allowed until the workspace opts in |
| `privileged` | Privileged evidence | Not allowed until the workspace opts in |

The mock provider runs inside Njumeni, so egress rules do not restrict it.

## 4. Providers

| Key | Kind | State | Notes |
|---|---|---|---|
| `mock` | Deterministic, offline | Enabled | Zero cost. Agent handlers produce reference output (e.g. `buildArgumentProposal`) |
| `anthropic` | Commercial API | Disabled | Adapter to be written with the official TypeScript SDK when the owner decides provider and budget (D-5) |
| `self-hosted` | Self-hosted model | Disabled | Reserved for institutional deployments (Phase 10) |

## 5. Agents

All 19 agents of master plan §5 are registered with the phase in which they become active. In Phase 5 the **reasoning** agent is implemented. It covers the issue and counterargument roles deterministically, with the mock provider. The others are activated by their phases: drafting in 7, quality and currency in 6, compliance in 10, translation in 12.

## 6. Argument graph

| Node types | Edge types |
|---|---|
| legal_issue, legal_question, applicable_rule, statutory_provision, judicial_interpretation, fact, evidence, claim, argument, counterargument, exception, defence, procedural_requirement, remedy, conclusion | raises, governed_by, interpreted_by, supports, contradicts, qualifies, argues_for, argues_against, rebuts, excepts, requires, yields, distinguishes |

Constraints are enforced by the database (see the Phase 5 plan §2). Quality is measured by `evaluateArgumentGraph`.

## 7. Adding a real provider (checklist)

1. Owner decision D-5: provider, data terms (no training; retention) and a monthly budget.
2. Implement `ModelProvider` with the official SDK. Map usage to `inputTokens` and `outputTokens`; never log prompt content.
3. Enable the provider in the registry. Each workspace opts in through `ai_update_workspace_settings`.
4. Run the reasoning evaluation on the jurisdiction's dataset before release (master plan §18).
