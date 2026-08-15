# dsh-antfarm

`dsh-antfarm` runs declarative multi-agent workflows as a DeepSeek Harness bundle. Workflows are YAML plus Markdown, each run is tracked in a plugin-owned JSONL journal, and Git worktree isolation is the default.

## Features

- Host-wide `ctx.antfarm` runtime; agent tools for run, list, status, cancel, resume, and cleanup; and the equivalent `/antfarm` command.
- Ordered workflow discovery, strict template expansion, bounded `STORIES_JSON`, and static persona validation.
- Bundled `smoke`, `feature-dev`, `bug-fix`, and `security-audit` workflows.
- Serial single steps, per-story fresh-session loops, independent `verifyEach` retries, top-level repair passes, bounded escalation to blocked, deadlines, and cancellation.
- Project-local `.worktrees/antfarm/<runId>` isolation and a temporary workspace coordinator for DSH rc.6 child cwd inheritance.
- Background jobs and flushed JSONL events containing the resolved workflow snapshot, child sessions, stories, retries, blocked state, and workspace disposition.
- Explicit resume of blocked runs and runs reconciled as interrupted after a process restart.
- Clean-only worktree removal; dirty or untracked output is retained.
- Antfarm Studio in the Web settings UI for run inspection and canonical workflow and agent-file editing.

`DESIGN.md` describes the architecture and phased implementation. The features above include the Phase 2 commands, resume path, additional workflows, and initial Studio views.

## Install

Install the published package into a DSH profile:

```sh
dsh plugin --profile web add dsh-antfarm
```

GitHub and local checkout installs use the same bundle manifest:

```sh
pnpm install
pnpm build
dsh plugin --profile web add /absolute/path/to/dsh-antfarm
dsh plugin --profile web add github:winterhuan/dsh-antfarm
```

Run `pnpm install` and `pnpm build` from this repository before adding its absolute path. A GitHub install runs the root `prepare` script; if pnpm blocks the dependency build, follow the `dsh plugin` diagnostic to add the exact package name to that profile's `allowBuilds`, then retry. The bundle is installed into the named profile; no automatic `custom-plugins` discovery is used.

## Use

Start a DSH session with the installed profile and call:

```text
antfarm_run({ workflow_id: "smoke", task: "..." })
```

The tool returns the reserved run, job, worktree, and branch immediately. The full agent tool set is `antfarm_run`, `antfarm_list`, `antfarm_status`, `antfarm_cancel`, `antfarm_resume`, and `antfarm_cleanup`. Use `antfarm_list`, `antfarm_status`, or the standard jobs tools to inspect progress.

Human-facing commands use the same runtime:

```text
/antfarm run <workflow> <task...>
/antfarm list
/antfarm status <runId>
/antfarm cancel <runId> [reason...]
/antfarm resume <runId> [guidance...]
/antfarm cleanup <runId>
```

Resume is explicit: startup reconciles non-terminal journals without starting model work, and `resume` continues a blocked or interrupted run in a fresh background job. The original owner must initiate it. Resume rejects terminal or active runs and worktrees whose recorded branch or HEAD no longer matches; it does not overwrite manual changes.

Workflow roots, highest precedence first, are:

1. `<project>/.antfarm/workflows`
2. `$DSH_HOME/antfarm/workflows` from the default bundle configuration
3. additional `workflowDirs`
4. this package's `workflows/`

The package workflows are:

- `smoke`: one worker step for installation and composition checks.
- `feature-dev`: plan, implement stories, verify each story, test, and review.
- `bug-fix`: reproduce, repair stories, verify each repair, and run regression tests.
- `security-audit`: identify demonstrated findings, remediate and verify them, and run a final audit.

## Studio

The Web profile loads Antfarm Studio under **Settings > Antfarm**. Its Runs view groups durable run state by repository. Workflow and Agents views edit the selected `workflow.yml` and `IDENTITY.md`, `SOUL.md`, or `AGENTS.md` files directly; YAML and Markdown remain the configuration source of truth.

The bundle enables Studio editing with `antfarm-studio-host.config.editable: true`. Set it to `false` in the profile patch for a read-only Studio. While Workflow or Agents is open, Studio detects canonical file changes and asks for an explicit refresh instead of overwriting an unsaved draft. Typert SRC remotes use DSH's `trusted-host` Web authority, so deployments that add LAN `trustedHosts` expose enabled Studio editing to those trusted authorities as well; external packages cannot promote one SRC method to DSH's loopback-only privileged method set.

## Storage

Run journals live under the configured `journalRoot`, defaulting to `$DSH_HOME/antfarm/runs/<runId>/events.jsonl`. Each `run-start` event stores the resolved workflow snapshot.

Worktrees live at `<repo-root>/.worktrees/antfarm/<runId>`. The plugin adds `/.worktrees/` to the repository-local `.git/info/exclude` when needed; it does not edit `.gitignore`. Completed worktrees are removed only when `git status --porcelain` is empty. Failed, interrupted, dirty, or untracked worktrees are retained.

## Development

```sh
pnpm typecheck
pnpm test
pnpm check:package
```

`check:package` builds the package, runs `publint`, performs an npm pack dry run, and imports every Host JavaScript export through plain Node ESM. The browser-only `lib/client.js` loader artifact is discovered from the `dsh.client` manifest and is intentionally absent from the Node export map.

Node.js `^22.19 || >=24` is required.

## Known Limitations

- DSH rc.6 has no per-child cwd override. The plugin creates a model-idle coordinator Agent carrying the run worktree cwd.
- Execution is serial by design; concurrent runs use independent worktrees, while one run has one driver.
- Journals survive process restart, but interrupted runs never restart model work automatically; an original owner must explicitly resume them.
- Role tool restrictions remove direct tools; a role retaining `bash` is not filesystem read-only. The deployment sandbox remains the security boundary.
