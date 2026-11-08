---
description: "Original Antfarm capability mapping and the scope of local acceptance evidence."
---

# Original Antfarm coverage

English | [中文](PARITY.zh.md)

## Summary

The comparison uses snarktank/antfarm 0.5.1 at `a442ad7dcb8cf8746175cc4a2e2dcafd501156cf`, with the source recorded in [the original fixtures](tests/fixtures/original-antfarm/SOURCE.txt). DSH replaces OpenClaw-specific scheduling and installation. Local tests verify execution rules; they do not establish real-model quality, GitHub delivery or remote installation.

## Capability mapping

| Original capability | DSH implementation and evidence |
|---|---|
| Install/uninstall all or one workflow | Native plugin installation and project enablement; active dependencies refuse uninstall or are cancelled/drained with force. [Management tests](tests/workflow-management.spec.ts) |
| Update, help, version and ant | Native DSH package update; commands preserve informational help, format/version identity and team explanation. Fixed Git installation, update and rollback are verified in isolated profiles. [Commands](src/commands/index.ts) |
| Discovery and custom YAML/Markdown | Project/user/package precedence, revision-bound copies and confined original imports. [Loader and importer tests](tests/workflow-management.spec.ts) |
| Run/list/status/search/stories | Stable numbers, task/id-prefix lookup, ambiguity rejection, paged lists and accepted story details. [Storage tests](tests/storage.spec.ts) |
| Peek/claim/complete/fail worker protocol | Host readiness/capacity, exclusive persisted child attempts and native structured output replace polling workers. Results cannot advance another attempt or bypass checkpoint validation. [Journal tests](tests/journal.spec.ts) |
| Ordered steps, story loops, per-story verification and retries | Fresh role attempts, independent verification, bounded earlier repair, accepted context and cumulative retry grants. [Driver tests](tests/orchestrator.spec.ts) |
| Roles/personas/shared files/models/timeouts/skills | Six presets; original AGENTS/SOUL/IDENTITY files are combined into confined role instructions. Missing required skills refuse admission. [Original import](src/workflow/original.ts) |
| Feature development, bug fixes and security remediation | Native official templates retain their different role sequences, PR delivery and feature review. [Workflow tests](tests/workflow.spec.ts) |
| Custom research and writing | Owned file workspaces, immutable explicit inputs, source handoffs, independent checks and retained outputs. Native file production/check/download/cleanup has local DSH evidence. [File tests](tests/files.spec.ts) |
| Autonomous cron/ensure-crons | Model-free Host queue/capacity and startup owner recovery; ensure-execution uses the same sole driver. [Capacity](tests/capacity.spec.ts) and [owner tests](tests/owner.spec.ts) |
| Stop/cancel/resume failed runs | Original owner authority, awaited teardown, preserved accepted checkpoints and explicit retry grants. [Runtime tests](tests/runtime.spec.ts) |
| Tested PR and GitHub review | Candidate-bound remote queries, write access and distinct approving review identity. Native role tools perform declared effects. A real feature task created its PR and received an official current-head approval by `continuous1024`. [Delivery tests](tests/delivery.spec.ts) |
| Frontend detection, browser checks and screenshots | Changed frontend paths trigger required successful native browser evidence and retained screenshots; missing capability blocks. A real-model feature task passed browser interactions with retained, visually inspected screenshots. [Visual tests](tests/delivery.spec.ts) |
| Global/per-run logs and events | Owner-scoped recent logs, per-run event pages and native transcripts; old rejected attempts remain inspectable. [Commands](src/commands/index.ts) |
| Dashboard/stages/details/output/stories/refresh | Native global workflow board and Session sidebar; no separate dashboard daemon. Visible views discover new work, support controls and preserve stale-read content. [Client tests](tests/runs.client.spec.tsx) |
| Medic install/uninstall/run/status/logs | Native runtime health settings, periodic/manual checks, history, overdue/inactive/uncertain diagnostics and ensure-execution for safe inactive work. No timeout can approve a result. [Health implementation](src/runtime/index.ts) |
| Escalation/owner notifications | Durable native owner inbox notices with Session flush confirmation. Successful local DSH delivery is recorded. [Notification tests](tests/notifications.spec.ts) |
| Workflow/Run webhooks and authentication | Explicit subscriptions, environment credential references, stable event ids, bounded waits and persisted uncertainty. An external service verified authentication, acceptance, rejection, timeout, uncertain delivery and event deduplication. [Notification tests](tests/notifications.spec.ts) |

## Material differences

DSH replaces polling-model calls with Host scheduling, SQLite business rows with authoritative journal checkpoints plus a rebuildable SQLite index, and standalone dashboards with native panels. Native structured output validates declared expectations before acceptance. Every required final check belongs to a candidate; repairs cannot preserve an obsolete passing check. File workflows use explicit input snapshots and retained output digests. Worktrees preserve branches and refuse dirty cleanup. Original timed abandonment resets (failure at the fifth abandonment) are replaced by awaited native deadlines; crash-open attempts stop for owner reconciliation instead of timed replay.

Original commands whose purpose is to manage OpenClaw cron workers or the dashboard process have native equivalents, not identical spellings. Polling-only model/cron fields are retained as import metadata; they do not cause model polling. Original imports preserve declared expectations but do not automatically infer native `requireChecks`, visual or delivery enforcement: use the bundled native templates or explicitly add these fields to an imported copy.

## Acceptance scope

Version `0.2.0` macOS and Linux checks cover Host/Client types, builds, packaging and 124 tests in 16 files. Native DSH `0.2.2-rc.1` Web verifies workflow editing, run controls, board navigation, artifact download and reading after cleanup; Headless verifies waiting for final business status and cold recovery. Fixed Git packages are verified in isolated profiles through installation, update, rollback, removal and reinstallation.

A real `deepseek-flash` feature task completed planning, implementation, independent verification, testing, PR delivery and review. The counter fixture passed seven tests and the browser sequence `0 → 2 → Reset 0 → Increment 1 → Reset 0`; Host verified actual commands, screenshots, PR head and `continuous1024`'s official approval against the same candidate. A real research task completed independent file roles, input snapshots, report retention and cold Headless recovery. Bounded retries and human reconciliation remain recorded; an initial blocked outcome or CLI exit code zero is not business completion.

Native lifecycle acceptance confirms that owner unloading preserves safe queued work; startup restores it without a parent model turn, while open attempts remain interrupted until explicit reconciliation. Explicit cancellation awaits teardown and records cancellation. An external webhook service received authenticated requests; rejection and timeout retain failed/uncertain outcomes, confirmed events are deduplicated, and notification failures leave business state unchanged.

The original three workflows have structural and import tests; full real-model delivery uses `feature-dev`, and research verifies file workflows. These scenarios do not establish quality or cost for every task or model. `deepseek-flash` has no image input, so model DOM checks are supplemented by separate visual screenshot inspection. DSH currently supplies no TUI application entry; Web and fully configured Headless are supported and verified, and TUI is not counted as passing.
