---
description: "Antfarm execution, candidate acceptance, checkpoint recovery, resource lifecycle and DSH ownership."
---

# Antfarm implementation

English | [中文](DESIGN.zh.md)

## Summary

Antfarm runs specialist workflows in owned Git or file workspaces and retains accepted checkpoints across Host restarts. DSH owns presets, model execution, child transcripts, jobs, permissions and subprocesses. Antfarm owns workflow configuration, admitted work, candidate acceptance, retries, recovery and output retention. This reference targets DSH `0.2.2-rc.1`; [README.md](README.md) owns installation and user actions.

## Table of Contents

- [Execution and checkpoints](#execution)
- [Recovery and ownership](#recovery)
- [Workspace lifecycle](#workspace)
- [Client and packaging](#client)
- [Validation](#validation)
- [Dev Note](#dev-note)

-----

<a id="execution"></a>
## Execution and checkpoints

The [loader](src/workflow/loader.ts) resolves version 2 YAML and Markdown before starting a run. It rejects unknown fields, invalid references, unsupported template keys, and instruction paths escaping the configured root. A saved run contains that resolved snapshot; recovery does not reload edited sources.

Each agent names a deployment-owned preset, Markdown instructions, and optional model/deadline overrides. The runtime requires a fresh local provider supporting presets, structured output, and Agent options. Each attempt reserves a native child id before activation, supplies the run cwd directly, awaits its result, validates structured output, and awaits child disposal. It uses no idle coordinator or separate model engine.

Native [execution evidence](src/runtime/evidence.ts) records foreground shell commands, candidate digests, exit status and bounded output. A required check cites an execution reference or the complete command and must complete successfully in the owned cwd without changing the candidate. Source edits or repairs invalidate previous final checks. Delivery queries bind an open PR and an approving review to the committed head; self-approval is refused. Frontend changes can require actual browser-command evidence and retained PNG/JPEG screenshots.

The [driver](src/runtime/orchestrator.ts) advances through complete [checkpoints](src/persistence/types.ts). A planner checkpoint accepts stories, summary, and next cursor together. A single-step checkpoint accepts the successful summary and cursor. Failures remain feedback and never enter accepted context as successful results. Parsing bounds summaries, stories, ids, acceptance criteria, and retry budgets.

Story loops execute the first non-done story in a fresh child. A separate configured verification child decides acceptance. Failure consumes the current story's retries and retains feedback; accepted stories remain done. The loop consumes its verification step rather than executing it again at top level.

Top-level failure consumes step retries, then a configured earlier repair target receives bounded attempts with failure feedback. Successful repair returns to the failed step. Loop repair uses `repairInput` across accepted stories without erasing done stories. Exhaustion records a blocked checkpoint for human recovery or settles the run as failed.

<a id="recovery"></a>
## Recovery and ownership

The [runtime](src/runtime/index.ts) validates a live initiating Agent for start/resume, records its Session id as owner, and saves admission before waiting for execution capacity. Reads and control actions require that Session id. Each run permits one local operation and one journal writer; contenders fail instead of starting a second driver. [Storage](src/persistence/storage.ts) uses an OS-backed SQLite lock for one Host per root and maintains a disposable query index. [Capacity](src/runtime/capacity.ts) limits actual attempts, preserving owner queue order while rotating eligible owners.

The [journal](src/persistence/journal.ts) saves sequenced, flushed version 3 JSONL records. [Fold](src/persistence/fold.ts) rejects malformed records and reconstructs the snapshot, checkpoint, attempt identity, and workspace disposition. Native Session logs stay under DSH ownership. [Native owner recovery](src/runtime/owner.ts) restores the original unarchived root composition without a model turn and dispatches saved safe work on startup. Open attempts stay interrupted for reconciliation. Crash-tail recovery retains original bytes and their digest.

A child can finish before its business checkpoint commits. An unmatched attempt signals uncertain effects, not proof that no work occurred. Resume requires guidance after inspecting its transcript and worktree, then uses fresh children from the last accepted checkpoint. External effects can repeat; this is checkpoint recovery, not exactly-once execution.

Resume verifies canonical paths, repository identity, expected branch, and ancestry from the captured base commit. Descendant commits and manual working-tree edits remain valid. Completed/cancelled or cleaned runs cannot resume. Failed runs require an explicit retry grant and retain cumulative history. Identifiable older or corrupt evidence is read-only and cannot silently migrate or rewrite.

Cancellation stops the current child and awaits disposal before committing terminal/disposition records and settling its job. Plugin disposal aborts operations and waits for completion. Cancelling inactive blocked/interrupted evidence takes the writer lease and retains output. A blocked run ends its background job but remains resumable.

<a id="workspace"></a>
## Workspace lifecycle

The [workspace owner](src/workspace/git.ts) captures the non-bare repository root, common Git directory, and current commit. It creates `antfarm/<runId>` from that commit in the project-local configured directory. Base checkout edits and untracked/ignored files are excluded; no environment files are copied. DSH subprocesses own Git execution, cancellation, output collection, and exit.

Creation rejects tracked destination directories, existing destinations, escaped paths, and symlinked/changed ancestors. Local Git exclude hides the configured worktree directory without changing tracked `.gitignore`. Identity checks require the expected branch and a HEAD descended from the saved base; child-created commits remain valid output.

Automatic cleanup is configurable for completed/cancelled runs. Failed/blocked runs retain output. Explicit cleanup requires an inactive terminal run and the writer lease. Tracked modifications, untracked files, ignored files, identity mismatch, and Git errors retain the workspace with a reason. Normal worktree removal never forces deletion and always preserves the branch.

The [file workspace](src/workspace/files.ts) supports research and writing outside Git. Admission snapshots explicitly declared UTF-8 inputs; each Run owns a separate directory and records output digests. Accepted artifacts are copied into private Run storage for preview/download after clean-up. Cleanup compares the retained candidate and refuses changes or escaped paths; original inputs remain outside the owned directory.

Presets constrain directly exposed tools. Verification keeps shell for checks, and skill execution can have further effects; removing write tools does not confine the filesystem. Deployment permissions, sandbox, and credentials still apply. Worktrees do not isolate remote APIs or the host account.

<a id="client"></a>
## Client and packaging

The [bundle patch](cordis.patch.yml) activates runtime, tools, commands, authorized Studio Host, a Client anchor, and six presets from one package. [package.json](package.json) pins DSH `0.2.2-rc.1`. Host builds generate Typert descriptors/declarations; Client mounts `dsh-antfarm/remote` before registering readers.

The [Studio Host](src/studio-host/index.ts) delegates Session-addressed list/status to runtime. [Client mounting](src/client/mount.tsx) registers one native right-sidebar tab and joins Remote, dictionaries, tab, and body lifetimes. It rolls back partial mounting and opens native child addresses. It also registers the native workflow board, revision-bound run controls and [workflow editor](src/client/WorkflowPanel.tsx). Profile writes require Host ownership. Dirty workflow drafts survive panel/Session navigation; launch retries reuse a stable admission id.

The [workflow manager](src/workflow/manager.ts) resolves project, configured user, then package resources. Editing creates writable overrides; it never rewrites bundled definitions. Canonical-path checks, serialized revision checks, unique temporary writes and immutable role revisions prevent escaped writes and stale saves. Enablement affects new admission; active Runs retain their snapshots. Removing an override restores the inherited definition.

Model-free health checks record bounded diagnostics and do not approve results. [Notifications](src/runtime/notifications.ts) persist delivery state and stable event identities. Native owner delivery awaits Session flush; explicit webhooks use environment credential references and retain uncertain outcomes. Health recovery dispatches only safe work through the existing driver.

The [query hook](src/client/queries.ts) retains loaded content on failure, aborts obsolete Session/selection requests, and ignores late completion. It polls visible views after reads finish, including empty or completed lists, to discover new Runs. [RunsPanel](src/client/RunsPanel.tsx) renders localized facts with native primitives. The board reads explicitly authorized root Sessions through the same runtime index.

<a id="validation"></a>
## Validation

The [tests](tests/) own workflow validation, checkpoints, journal corruption, worktrees, cancellation, recovery, and Client reads/lifetimes. Boundary doubles provide deterministic unit evidence; they do not prove model execution or browser transport. Current results belong in a dated acceptance record; [baseline coverage](PARITY.md) separates implementation from external acceptance.

Use [README development commands](README.md#understand-the-implementation) for typecheck, build, tests, and package checks. Before release, verify isolated DSH bundle/presets, native child cwd and structured output, Runs/child navigation, and the target platform. Model/network access and remote installation need separate executed evidence.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The runtime excludes implicit journal migration, shared execution directories, automatic environment copying and a second model scheduler. Native Workflow/Agent Team remain independent because they do not supply this Run's durable cursor and required checkpoint bindings.

</details>
