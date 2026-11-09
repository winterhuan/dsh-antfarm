---
description: "Original Antfarm behavior mapping and release verification scope."
---

# Original Antfarm coverage

English | [中文](PARITY.zh.md)

## Summary

The baseline is snarktank/antfarm `0.5.1`, recorded in [original fixtures](tests/fixtures/original-antfarm/SOURCE.txt). The three original YAML workflows and persona resources are bundled unchanged. DSH supplies native execution, ownership and UI; SQLite retains the original business method. This page distinguishes mechanism checks, release installation and real-model quality evidence.

## Capability mapping

| Original capability | Native implementation and verification owner |
|---|---|
| Workflow and persona resources | Exact original YAML, AGENTS/SOUL/IDENTITY files; [resource tests](tests/workflow.spec.ts). |
| Agent identities, roles and models | Stable workflow-qualified identity, conditional persona, shared standard composition, tool dispatch policy; [runtime tests](tests/runtime.spec.ts). |
| SQLite persistence | Original business columns and atomic transitions; [database tests](tests/database.spec.ts). |
| Peek/claim/complete/fail | Model-free ready checks, exact native claimant, original text results and failure budgets; [database](src/persistence/database.ts). |
| Story loop and verify-each | Original STORIES_JSON, fresh attempts, story retries and preserved resume counts; [database tests](tests/database.spec.ts). |
| Deadlines and abandonment | Native child deadlines/disposal feed separate single-step abandonment and per-story retries. |
| Agent workspace, skills and progress | Stable directories, managed persona updates, optional native skill lookup, original progress archive; [adapter](src/runtime/agents.ts). |
| Install/uninstall/import | Native bundle installation and revision-bound project/user overrides; [management tests](tests/workflow-management.spec.ts). |
| Run/list/status/stories/logs | Original SQL summaries, Session ownership, number/prefix/task lookup, native transcripts. |
| Stop/resume | Exact child cancellation, interrupted-owner recovery and late-result rejection; [runtime tests](tests/runtime.spec.ts). |
| Frontend detection | Original production-file detector via native Git subprocesses; [progress adapter](src/runtime/progress.ts). |
| Events/webhooks | Original event fields, best-effort authenticated HTTP, drained requests; [webhook tests](tests/notifications.spec.ts). |
| Dashboard and medic | Native sidebar/authorized board, periodic diagnostics and safe ensure-execution; [client tests](tests/runs.client.spec.tsx). |
| Historical DSH runs | Complete-prefix, owner-authorized read-only inspection without byte changes; [legacy tests](tests/legacy.spec.ts). |

## Material differences

DSH Jobs and model-free Host polling replace OpenClaw cron/polling models; DSH panels replace a separate dashboard daemon. Agents share a native capability composition while preserving their individual personas. Native owner/attempt/host associations are extra SQL tables, and original business rows remain authoritative.

DSH requires reconciliation before replaying crash-open attempts, instead of inferring safety from an expired timer. Exact claimant identities reject stale results. Referenced verify-each steps can run while their loop is waiting for verification, and exhausted verification exposes a resumable failed step; these avoid original predecessor/recovery stalls. Role deadlines retain the original retry/abandonment budgets after confirmed teardown.

Original personas still reference OpenClaw worker completion commands. Native task input directs agents to return the original final text and lets the Host record completion. Optional skills resolve through DSH providers. Webhook credentials use native environment references rather than URL fragments. Single-step failure directives remain metadata; the original worker completion path does not enforce them as a general retry graph.

The native adapter distinguishes business success, verification rejection and execution failure: replies require `STATUS: done|retry|failed`, and success also requires the `expects` text. Single-step rejection stops the run, story rejection retries the story, and execution failure uses the existing budget. Recovery guidance enters the next input. Persona variables resolve fully; unchanged templates retain and load local learning, while conflicting template/local changes stop the attempt.

A worker’s successful reply is its reported result. The adapter does not add independent candidate-bound checks, GitHub review approval, immutable artifact snapshots, research/writing templates, additional retry grants or per-run worktree cleanup. Custom original-format workflows remain supported.

<a id="acceptance-scope"></a>
## Acceptance scope

Isolated Web acceptance completes feature-dev (7 attempts), bug-fix (6 attempts) and security-audit (7 attempts). SQLite confirms three completed runs and twenty distinct native Session IDs, each with real Bash execution. Browser inspection covers the board, step outputs and child navigation; model outcomes and PR URLs are deterministic fixture data. A further saved project override completes after restart, writes and archives native progress, detects a real frontend Git change, and omits native gateway/cron equivalents from child tools.

The implementation checks cover macOS Host/Client types, clean builds, package composition, original SQL/identity/lifecycle behavior, client queries, historical preservation and webhook teardown. Native Web acceptance uses an isolated DSH `0.2.2-rc.1` profile and a deterministic model adapter; original step outcomes and native child/tool execution are checked separately from CLI exit.

With DSH `0.2.2-rc.1` installed and the plugin built, run `node tests/native-protocol.e2e.mjs` for isolated Headless protocol acceptance. It composes native presets and a deterministic model in a temporary profile, checks eleven distinct Sessions/Bash calls, execution failure retries, story rejection, explicit recovery after final review rejection, dynamic personas and local learning, and compares a fixed expected result. It removes temporary resources on exit.

Real-model usefulness, live GitHub delivery and Linux/Windows behavior are not established by these deterministic checks. Remote release installation requires separate package/configuration and browser evidence. Previous `0.2.0` release evidence describes that release’s different runtime and does not validate this implementation. DSH has no TUI entry on the pinned version; default Headless lacks the required preset composition.

## Dev Note

Additional platforms and representative real-model tasks require their own recorded acceptance.
