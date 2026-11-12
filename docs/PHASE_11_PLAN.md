# Phase 11 — Commercial infrastructure

| Field | Value |
|---|---|
| Phase state | 🔵 **IMPLEMENTED: verified locally.** Formal closeout pending §5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md) §17 (commercial architecture), §17.1 plans, §17.3 metering, §17.4 billing architecture, U-23 (cost guardrails) |
| Builds on | Phase 1 Task 1.10 (provider-neutral plans, subscriptions, entitlements, usage ledger) |
| Execution mode | Owner-directed continuous autonomous mode: one commit per completed phase |
| Acceptance (master plan) | Billing end-to-end in staging |

## 1. Objective

Complete the master plan's commercial chain:

> Plans → subscriptions → entitlements → **usage metering → quota enforcement → invoices and payments → revenue analytics**

Two rules hold throughout:
- Billing never grants or removes access to legal records.
- High-cost AI is never unlimited on a low-priced plan (U-23).

Nothing here spends money. Prices are the master plan's hypotheses, and no payment provider is connected until the owner decides.

## 2. Design

| Element | Implementation |
|---|---|
| Plan catalogue | `subscription_plans` gains a monthly price (minor units), currency, overage policy and display order (migration `20261112600000`). `plan_entitlements` holds each plan's allowances: AI credits, research runs, generated documents, API requests, seats and storage (null = contracted), plus per-unit overage prices. `billing_plans()` is public |
| Effective plan and period | `private.billing_current`: the active subscription's plan and period, or the **free plan** with the calendar month. Overage applies only to paid plans in good standing (`active` or `trialing`); for everyone else allowances are **hard stops** |
| Limits | `entitlement_limit`: contracted entitlements on the subscription override plan defaults, and AI credit top-ups bought in the period are added. 1 AI credit = USD 0.01 of provider cost |
| Metering | Automatic and idempotent (`usage_records`): every research run; every paid AI execution (credits from its recorded cost; **the built-in mock provider is never metered**); each final document export, once per version; every API-key request |
| Enforcement | In the database, at the operation: a research run beyond the allowance → `QUOTA_EXCEEDED` (53400), returned by the API as **429 `quota_exceeded`** and shown in the interface; final exports beyond the allowance are refused (re-exports are free); API keys stop at their allowance; `ai_authorise_execution` refuses paid AI with `AI_PLAN_QUOTA_EXCEEDED` when the credits are used. Workspace token budgets (Phase 5) still apply on top |
| AI credit top-ups | `credit_grants` (append-only), from purchases (provider webhook) or audited administrator adjustments |
| Invoices | `billing_generate_invoice` (platform administrators or the billing integration) bills a closed period: the plan fee plus overage lines beyond each allowance (top-ups count), with VAT at a stated rate. Numbering is gap-free (`INV-YYYY-NNNNNN`). Issued invoices are **immutable**; only open → paid or open → void is possible. Zero-value invoices are issued as paid. PDF: `GET /api/v1/billing/invoices/{id}/pdf` (billing readers only) |
| Payment webhooks | `POST /api/billing/webhooks/{provider}` relays the raw body and signature header. **`billing_webhook` verifies the HMAC-SHA256 signature (`t=…,v1=…`, Stripe-compatible) with the provider secret held in the database**, checks freshness (default 5 minutes) and deduplicates by event id. It handles subscription created, updated and deleted (via the Phase 1 snapshot function), invoice paid and credit purchases; other events are recorded as ignored. The web app holds neither the provider secret nor a service-role key |
| Commercial analytics | `platform_commercial_analytics` (operators): MRR, subscriptions by plan and status, usage this month, AI cost, invoiced and outstanding amounts, credit top-ups, webhook outcomes. Customers cannot see it |
| Interface | `/billing` ("Plan and usage": the plan, meters with allowance states, seats, invoices with PDFs, top-ups and the plan catalogue); `/admin` shows commercial analytics; the research form explains a reached allowance |

## 3. Tasks

| # | Task | State |
|---|---|---|
| 11.1 | Plan prices, allowances and overage rules | ✅ |
| 11.2 | Automatic, idempotent usage metering | ✅ |
| 11.3 | Quota enforcement (hard stops on free; billed overage on paid) | ✅ |
| 11.4 | AI credit allowance and top-ups (U-23) | ✅ |
| 11.5 | Immutable invoices with overage and VAT; invoice PDF | ✅ |
| 11.6 | Signed, idempotent payment-provider webhooks verified by the database | ✅ |
| 11.7 | Commercial analytics | ✅ |
| 11.8 | Plan and usage page | ✅ |
| 11.9 | Provider checkout sessions and a customer portal | ⏸ Owner decision: payment provider and account (no spend before then, ADR-0003) |
| 11.10 | Scheduled monthly invoicing | ⏸ Phase 13 scheduler (the function exists; it is idempotent per organisation and period) |

## 4. Verification (local, 2026-11-12)

| Check | Result |
|---|---|
| pgTAP | **661/661** in 22 files (`commercial_infrastructure` 34/34). Every earlier suite passes with metering and quotas active |
| Application tests | **246/246** (`billing` 3; API contract extended to invoice PDFs and `quota_exceeded`) |
| Type check, Prettier (CI set), content policy, migration guard, release gates, `next build` | ✅ |
| Billing end to end over HTTP on the built app (synthetic) | ✅ See below |

pgTAP covers:
- the public catalogue; free by default;
- metering of research runs; the free hard stop at 30 runs;
- documents: re-export is free; the free hard stop for generated documents; drafts are never metered;
- AI credits from the paid execution's cost (1 credit), none for the mock; the plan quota stops paid AI; the mock is never blocked;
- webhooks: forged, replayed-old, tampered and unconfigured deliveries are rejected; a signed subscription event upgrades to Professional, with overage and research continuing;
- credit purchase granted once; redelivery reported as a duplicate; allowance 4,000 + 500;
- customers cannot issue invoices or see revenue; the administrator issues an invoice (79.00 + 25% VAT = **98.75**); MRR is reported; invoices are immutable; the provider marks the invoice paid, and the customer sees it.

Billing end to end over HTTP:
1. A new user on the free plan with 30 runs used: the next research request → **429 `quota_exceeded`**.
2. A forged webhook → **401**. A correctly signed subscription webhook → 200, applied. Research → **201** again.
3. A credit purchase was applied; its redelivery reported `duplicate`.
4. The operator issued the invoice. The customer downloaded its PDF (`pdftotext`: "Professional plan · 1 × US$79.00", "Total: US$98.75").
5. The signed `invoice.paid` → paid. `/billing` shows Professional and the paid invoice; `/admin` shows commercial analytics.

## 5. Closeout conditions outstanding

| # | Condition | Dependency |
|---|---|---|
| 1 | CI green on the Phase 11 commit | Automatic on push |
| 2 | Billing end to end **in staging** with a real payment provider in test mode | Owner decision on the provider; Stage 2 staging |
| 3 | Prices validated with customers (§17.1 hypotheses) | Pilot customers (Phase 13) |
| 4 | VAT/MVA treatment confirmed per jurisdiction | Accounting advice before the first invoice |

## 6. Decisions

- **Enforce where the cost occurs.** Quotas are checked by triggers and by the AI authoriser in the database, so no client path can skip them.
- **The database verifies the payment provider.** The web route only relays bytes. A compromised web server cannot forge a subscription, and the secret never leaves the database.
- **The mock is free forever.** Development, demos and the public build never consume credits.
- **Invoices are records, not views.** Once issued an invoice never changes; corrections are voids plus new invoices.
