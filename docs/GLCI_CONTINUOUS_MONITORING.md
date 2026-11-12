# GLCI-12 — Continuous monitoring and recovery testing

| Field | Value |
|---|---|
| Migration | `20261114400000_glci_continuous_monitoring` |
| UI | Super Admin → Global Legal Observatory → *Continuous monitoring* |
| Related | [GLCI specification](GLCI_SPECIFICATION.md) §8 · [Journey register](GLCI_JOURNEY_REGISTER.md) · [Governance](GLCI_GOVERNANCE.md) |

## 1. Principle

A dead worker cannot report its own death. The alarms that say "monitoring has stopped" therefore run **inside the database**, on a schedule, and never depend on the monitoring worker.

## 2. Parts

| Part | What it does |
|---|---|
| Worker heartbeat | `glci_worker_heartbeat(worker_id, kind, summary)` (service role). The monitoring worker reports after every cycle. |
| `monitoring_overdue` issue (high) | An active source was due more than an hour ago and nobody checked it. |
| `worker_silent` issue (critical) | Checks are overdue and no monitoring worker has reported for two hours. |
| Housekeeping `glci_tick()` | Reconciles issues every run; once a day also runs currency verification and takes an audit checkpoint. Scheduled hourly at :17 with pg_cron (`glci-housekeeping`); the worker also calls it each cycle. |
| Recovery drill `glci_run_recovery_drill()` | Creates a synthetic source and target and drives the **real** functions through failure and recovery, inside a savepoint that is always rolled back. Only the result is kept (`private.glci_drill_runs`, append-only) and audited. Safe on production. |
| Status `glci_continuous_status()` | Scheduler, workers, overdue targets and the last five drills, for the observatory. |

Alarms resolve themselves when the condition clears, like every GLCI issue.

## 3. Drill scenarios

| Scenario | Proves |
|---|---|
| Source outage | Three failed checks open an "unreachable" issue; currency reads "check failing", never current |
| Outage recovery | A successful check resolves the issue automatically |
| Format change | An integration failure opens a critical issue with an engineering-task proposal |
| Replay / idempotency | The same listing twice is "unchanged"; reconciling twice adds nothing |
| Failed sync item and retry | A retryable item failure is listed for retry when due and resolved on success |
| Overdue alarm | A source nobody checks raises an alarm from the database alone |
| Audit integrity | The audit chain verifies and agrees with every checkpoint |

## 4. Runbook

- **`worker_silent` open:** the monitoring worker (`npm run worker:glci-monitor`) is not running or cannot reach Supabase. Restart it on the worker host; the issue resolves after its next successful cycle.
- **`monitoring_overdue` open, worker alive:** the worker cannot keep up or the target's checks fail before recording. Check the worker log for `glci.monitor` lines for that target.
- **Drill failed:** a scenario names what broke. Treat it as a release blocker; the drill runs against the deployed functions.
- **Housekeeping says "runs only when the monitoring worker runs":** pg_cron is not installed; enable it (Supabase: Database → Extensions) and re-apply the schedule from the migration.

## 5. Tests

| Suite | Covers |
|---|---|
| `glci_continuous_monitoring.test.sql` (17) | Schedule exists; tick with the service role; overdue and silent-worker alarms without a worker; daily currency and checkpoint; heartbeats; alarms resolve; customers and non-service callers refused; drill passes, covers seven scenarios, leaves nothing behind |
| Browser journey GLCI | An operator runs the recovery drill from the observatory; it passes and lists its scenarios |
