---
description: "Reusable team workflows, candidate verification, workflow configuration and native DSH run controls."
kind: "package-bundle"
---

# dsh-antfarm

English | [中文](README.zh.md)

## Summary

Run reusable specialist workflows for development, bug fixes, security remediation, research and writing. Edit workflow copies, inspect verified results, and control runs from the native DSH sidebar and workflow board. Accepted progress survives restarts; uncertain effects require your review. This development checkout targets DSH `0.2.2-rc.1` and is installed in an isolated profile.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Antfarm is an installable profile layer supplying workflow tools, the `/antfarm` command, six Agent Presets, a Runs tab with controls, and a workflow board. It requires Node.js `^22.19 || >=24`, pnpm `11.7.0`, Git, and DSH `0.2.2-rc.1`.

Use a Web or TUI profile with native Agent Preset composition. Default headless profiles lack the Agent Preset registry and parent preset; a custom headless profile must provide both before installing this bundle.

### Install into a development profile

Build this checkout before linking its root directory. Use a separate `DSH_HOME` and profile; point `workspace-controller.config.documentsDirectory` at a temporary directory before opening Web. The current remote `main` and existing `0.1.0` release do not yet provide this development implementation; a remote installation needs a new verified, fixed release commit.

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm test
```

In the isolated environment, use `dsh plugin --profile antfarm-dev add link:/absolute/path/to/dsh-antfarm`. Restart that development service and hard-refresh Web after rebuilding. Remove the layer with `dsh plugin --profile antfarm-dev remove dsh-antfarm`. [cordis.patch.yml](cordis.patch.yml) activates all Host and Client entries together. Checkout edits do not update daily profiles.

### Start and inspect a run

For coding workflows, start from a Session whose cwd belongs to a non-bare Git repository with a commit. Research and writing use `workspace: files` and also work outside Git. The model can call `antfarm_run` with `task`, optional `workflow_id` and `background`; the default workflow is `feature-dev`. Run and resume tools wait for the final accepted, failed or blocked status unless `background: true` is supplied. Slash commands and panel launches return a durable receipt with run/job identifiers and the owned workspace while execution continues.

```text
/antfarm run implement payment callbacks
/antfarm smoke inspect the repository and report the available test commands
/antfarm run --workflow feature-dev implement payment callbacks
/antfarm list
/antfarm status <runId-or-number>
/antfarm cancel <runId> [reason...]
/antfarm resume <runId> [--retry-grant 1..20] [guidance...]
/antfarm cleanup <runId>
/antfarm workflows
/antfarm logs [runId-or-number]
/antfarm stories <runId-or-number>
/antfarm health
/antfarm ensure-execution
/antfarm help
```

The short form `/antfarm <task...>` uses the default workflow. `fix`, `audit`, and `smoke` select `bug-fix`, `security-audit`, and `smoke`. Use `run` when task text begins with a reserved command word. The model also has `antfarm_list`, `antfarm_status`, `antfarm_cancel`, `antfarm_resume`, and `antfarm_cleanup`; all enforce the initiating Session's ownership.

Open **Antfarm** from the Web right sidebar to choose a workflow, describe a task, and inspect its runs. Use the global **Antfarm workflow board** to group authorized Sessions by workflow and current stage. Lists load fifty runs per page and show stable numbers, tasks, accepted story progress, outputs, candidate checks, retained files, events and native child-session links. Visible views refresh, including empty and completed lists; hidden views stop polling. Failed reads retain loaded content.

### Recover and preserve output

Host startup restores the native authority of the original, unarchived root Session and dispatches saved safe work without a parent model turn. An open attempt stays interrupted. Resume blocked, interrupted or failed work from its owner; failed runs require an explicit additional retry grant. Accepted checkpoints preserve done stories and successful summaries; failed output remains feedback. Recovery uses the saved workflow snapshot, so YAML edits affect new runs.

An unfinished attempt means that child effects are uncertain. Inspect its transcript and retained worktree, then supply explicit reconciliation guidance to `resume`. A fresh child can repeat filesystem or external effects after the last accepted checkpoint. Antfarm does not provide exactly-once execution. GitHub phases query the PR head and approving review before accepting delivery. Resume rejects completed/cancelled or cleaned runs, concurrent writers, changed repository identity, changed/detached branches, and HEADs that no longer descend from the recorded base.

Each worktree starts from captured repository `HEAD`, excluding base checkout uncommitted, untracked, and ignored files. Antfarm copies no environment files. Prepare required dependencies and credentials through deployment mechanisms; the worktree is not a copy of the laptop working directory.

Completed and cancelled runs attempt cleanup when enabled. Cleanup removes only an identity-validated worktree with no tracked modifications, untracked files, or ignored files, and preserves its branch. Failed and blocked runs retain output. Save output before cleanup; cancel blocked/interrupted runs before cleaning. Identity changes and Git errors retain the directory with a reason.

### Configure workflows and presets

Discovery checks `<repo>/.antfarm/workflows`, configured `workflowDirs` in order, then package [workflows](workflows/). The bundle supplies `$DSH_HOME/antfarm/workflows` as a configured directory. Use `version: 2` YAML and relative Markdown instructions; [smoke](workflows/smoke/workflow.yml) is the smallest example.

Each agent selects a deployment-owned `preset` and one `instructions` file, with optional `model` and `timeoutSeconds`. The bundle installs `antfarm-analysis`, `antfarm-coding`, `antfarm-verification`, `antfarm-testing`, `antfarm-scanning` and `antfarm-pr`. Analysis omits shell and disables direct write tools; verification disables direct write tools but keeps shell for tests. A role with shell or skill access is not filesystem read-only. DSH permissions and sandbox govern access beyond the worktree.

### Workflow copies and effective settings

In **Configure workflow**, inspect the effective source, edit YAML or role Markdown, and validate/save a project or user override. Project definitions take precedence over configured user roots and packaged workflows. Create a project copy to choose another id; remove an override to restore inheritance. Saves compare the source revision and refuse competing changes. Dirty drafts survive panel and Session navigation; reloading the browser requires discarding or saving them first.

Use `/antfarm install <id|all>` and `/antfarm uninstall <id|all> [--force]` to change project enablement. Uninstall refuses active dependent work; `--force` cancels and drains it. Resources and Run evidence remain available. Import original definitions with `/antfarm import <directory> <sourceRoot> [--files]`; the explicitly selected root must contain all shared role files.

DSH's native Plugins settings edit the `antfarm-runtime` configuration. Defaults and cleanup settings are captured for each new Run; structural configuration changes restart the service and interrupt uncertain work. Host/owner capacity limits govern execution, not durable admission.

| Setting | Purpose |
|---|---|
| `defaultWorkflowId`, `defaultStepTimeoutSeconds` | Default workflow and attempt deadline |
| `maxActiveRuns`, `maxActiveRunsPerOwner` | Host and owner execution capacity |
| `maxAttempts`, `maxStories`, `maxStoryRetries` | Deployment ceilings for bounded work |
| `healthEnabled`, `healthIntervalMs` | Model-free health checks and their interval |
| `webhookUrl`, `webhookTokenEnv` | Explicit lifecycle subscription and native environment credential reference |
| `githubReviewerTokenEnv` | Optional distinct GitHub reviewer credential reference |

File workflows capture declared UTF-8 `inputs` at admission and produce files in an owned `.antfarm/runs/<runId>` directory. Output snapshots are retained by digest. Preview/download them before or after explicit cleanup; original input files are not changed. GitHub workflow stages declare PR creation and approval. Selecting those workflows authorizes their declared delivery operations; merging remains separate. A self-review, missing browser capability, or unconfirmed remote effect blocks acceptance.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation and development — click to expand</summary>

[Runtime](src/runtime/index.ts) admits owner-scoped operations and leased journal writers. The [driver](src/runtime/orchestrator.ts) executes serial DSH child activations with presets, cwd, instructions, and structured output. Complete checkpoints accept planner stories and cursor together, or one successful step/story result. Required checks cite actual native shell execution on the same candidate; repairs invalidate final checks. Native DSH stores transcripts; Antfarm stores business progress.

Journals default to `$DSH_HOME/antfarm/runs/<runId>/events.jsonl`. The [journal](src/persistence/journal.ts) flushes version 3 records; [fold](src/persistence/fold.ts) reconstructs accepted state. Unsupported/corrupt evidence with an identifiable owner is inspection-only and cannot resume or clean. Antfarm appends no private events to native Session journals.

Worktrees default to `<repo>/.worktrees/antfarm/<runId>` on `antfarm/<runId>`. The [workspace owner](src/workspace/git.ts) adds the configured directory to repository-local Git exclude, verifies canonical paths and Git identity, and uses DSH subprocesses for Git. It never forces removal or deletes branches.

Before committing, run `pnpm run typecheck`, `pnpm run build`, and `pnpm test`. `pnpm run check:package` also builds, runs `publint`, performs an npm pack dry run, and imports Host entries in plain Node ESM. Client uses DSH's browser loader and generated `dsh-antfarm/remote`; it is not a plain Node entry. Real DSH and model/network acceptance remain separate from unit tests.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

[DESIGN.md](DESIGN.md) explains checkpoints, retries, cancellation, and resource ownership. [cordis.patch.yml](cordis.patch.yml) defines presets and services. [package.json](package.json) defines exact DSH versions and build exports.

-----

<a id="model-experience"></a>
## Model Experience

### Workflow tools and child instructions

#### What the model sees

The initiating model receives six workflow control tools, including `antfarm_run`. Child sessions cannot access these tools or start workflows. Each fresh child receives its role preset, project instructions, the resolved step input, accepted prior results, and the native `structured_output` requirement. Bash results expose an execution reference for structured checks. `antfarm_status` shows the reason and up to three recent accepted outputs, each limited to 2,000 characters. Runs UI reads do not enter model context.

#### Token effect

Role instructions and the tool schemas contribute stable prompt text. Step inputs, story feedback, accepted summaries and human reconciliation guidance add bounded run-specific text to each child.

#### KV Cache effect

The bundle adds no request prefix. Presets supply instructions; each fresh child receives step-specific context and its output schema.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Each Run executes serially. Host capacity defaults to eight attempts, at most two per owner; admitted work waits in a persistent queue.
- Worktrees separate checkout content, not shell, network, credentials, or external effects.
- Original YAML/Markdown workflows can be imported; older Run journals remain inspection-only. Shared execution directories and automatic environment copying are unsupported.
- The board includes explicitly authorized root Sessions. Archived owners must be restored before execution can resume.
- The default `spawn` provider must support fresh local presets, structured output, and Agent options; inherited-context providers are rejected.
- GitHub publishing/review, browser checks, real-model quality and remote installation need independent acceptance evidence. Local deterministic tests do not establish those outcomes.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This is the development contract, not a release or acceptance report. Record actual command exits and browser evidence before release. The installation entry requires the current build and isolated DSH acceptance.

</details>
