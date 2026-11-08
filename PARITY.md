---
description: "Original Antfarm capability mapping and the scope of local acceptance evidence."
---

# Original Antfarm coverage

English | [中文](PARITY.zh.md)

## Summary

The comparison uses snarktank/antfarm 0.5.1 at `a442ad7dcb8cf8746175cc4a2e2dcafd501156cf`, retained with provenance in [the original fixtures](tests/fixtures/original-antfarm/PROVENANCE.txt). DSH replaces OpenClaw-specific scheduling and installation. Local tests verify execution rules; they do not establish real-model quality, GitHub delivery or remote installation.

## Capability mapping

| Original capability | DSH implementation and evidence |
|---|---|
| Install/uninstall all or one workflow | Native plugin installation and project enablement; active dependencies refuse uninstall or are cancelled/drained with force. [Management tests](tests/workflow-management.spec.ts) |
| Update, help, version and ant | Native DSH package update; commands preserve informational help, format/version identity and team explanation. Remote package update acceptance is pending. [Commands](src/commands/index.ts) |
| Discovery and custom YAML/Markdown | Project/user/package precedence, revision-bound copies and confined original imports. [Loader and importer tests](tests/workflow-management.spec.ts) |
| Run/list/status/search/stories | Stable numbers, task/id-prefix lookup, ambiguity rejection, paged lists and accepted story details. [Storage tests](tests/storage.spec.ts) |
| Peek/claim/complete/fail worker protocol | Host readiness/capacity, exclusive persisted child attempts and native structured output replace polling workers. Results cannot advance another attempt or bypass checkpoint validation. [Journal tests](tests/journal.spec.ts) |
| Ordered steps, story loops, per-story verification and retries | Fresh role attempts, independent verification, bounded earlier repair, accepted context and cumulative retry grants. [Driver tests](tests/orchestrator.spec.ts) |
| Roles/personas/shared files/models/timeouts/skills | Six presets; original AGENTS/SOUL/IDENTITY files are combined into confined role instructions. Missing required skills refuse admission. [Original import](src/workflow/original.ts) |
| Feature development, bug fixes and security remediation | Native official templates retain their different role sequences, PR delivery and feature review. [Workflow tests](tests/workflow.spec.ts) |
| Custom research and writing | Owned file workspaces, immutable explicit inputs, source handoffs, independent checks and retained outputs. Native file production/check/download/cleanup has local DSH evidence. [File tests](tests/files.spec.ts) |
| Autonomous cron/ensure-crons | Model-free Host queue/capacity and startup owner recovery; ensure-execution uses the same sole driver. [Capacity](tests/capacity.spec.ts) and [owner tests](tests/owner.spec.ts) |
| Stop/cancel/resume failed runs | Original owner authority, awaited teardown, preserved accepted checkpoints and explicit retry grants. [Runtime tests](tests/runtime.spec.ts) |
| Tested PR and GitHub review | Candidate-bound remote queries, write access and distinct approving review identity. Native role tools perform declared effects. Live GitHub acceptance is pending. [Delivery tests](tests/delivery.spec.ts) |
| Frontend detection, browser checks and screenshots | Changed frontend paths trigger required successful native browser evidence and retained screenshots; missing capability blocks. Real frontend/model acceptance is pending. [Visual tests](tests/delivery.spec.ts) |
| Global/per-run logs and events | Owner-scoped recent logs, per-run event pages and native transcripts; old rejected attempts remain inspectable. [Commands](src/commands/index.ts) |
| Dashboard/stages/details/output/stories/refresh | Native global workflow board and Session sidebar; no separate dashboard daemon. Visible views discover new work, support controls and preserve stale-read content. [Client tests](tests/runs.client.spec.tsx) |
| Medic install/uninstall/run/status/logs | Native runtime health settings, periodic/manual checks, history, overdue/inactive/uncertain diagnostics and ensure-execution for safe inactive work. No timeout can approve a result. [Health implementation](src/runtime/index.ts) |
| Escalation/owner notifications | Durable native owner inbox notices with Session flush confirmation. Successful local DSH delivery is recorded. [Notification tests](tests/notifications.spec.ts) |
| Workflow/Run webhooks and authentication | Explicit subscriptions, environment credential references, stable event ids, bounded waits and persisted uncertainty. Live external subscription acceptance is pending. [Notification tests](tests/notifications.spec.ts) |

## Material differences

DSH replaces polling-model calls with Host scheduling, SQLite business rows with authoritative journal checkpoints plus a rebuildable SQLite index, and standalone dashboards with native panels. Native structured output validates declared expectations before acceptance. Every required final check belongs to a candidate; repairs cannot preserve an obsolete passing check. File workflows use explicit input snapshots and retained output digests. Worktrees preserve branches and refuse dirty cleanup. Original timed abandonment resets (failure at the fifth abandonment) are replaced by awaited native deadlines; crash-open attempts stop for owner reconciliation instead of timed replay.

Original commands whose purpose is to manage OpenClaw cron workers or the dashboard process have native equivalents, not identical spellings. Polling-only model/cron fields are retained as import metadata; they do not cause model polling. Original imports preserve declared expectations but do not automatically infer native `requireChecks`, visual or delivery enforcement: use the bundled native templates or explicitly add these fields to an imported copy.

## Acceptance scope

Local unit and native DSH evidence establish loading, structured role execution, actual shell check capture, file retention/download/cleanup, original imports, run controls, board navigation and persisted owner delivery. Real DSH also verifies workflow copy/edit/save/read, disable/re-enable, inherited-source restoration, and logs/stories/health/ensure-execution commands. Production readiness still requires target-platform checks on this exact code, a configured real-model representative task, live PR/review/browser scenarios, and fixed remote package installation. An implementation mapping alone is not full verified parity.
