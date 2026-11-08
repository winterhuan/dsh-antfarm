---
description: "Original Antfarm teams, persona identities, SQLite progress and native DSH run controls."
kind: "package-bundle"
---

# dsh-antfarm

English | [中文](README.zh.md)

## Summary

Run the original feature-development, bug-fix and security-audit teams in DSH. Each specialist keeps its own identity, persona and workspace, while each attempt gets a fresh Session. Inspect step outputs, stories and native transcripts from the sidebar or workflow board. Version `0.3.0` targets DSH `0.2.2-rc.1` and preserves historical `0.2.0` runs for inspection.

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

### Install and develop

Use Node.js `^22.19 || >=24`, pnpm `11.7.0` and a DSH `0.2.2-rc.1` Web profile providing the native `standard` Agent Preset and local `spawn` provider. The bundle adds five workflow tools, the `/antfarm` command, the Session sidebar and the workflow board. It registers no Antfarm role presets.

Install the immutable release tag into a Web profile:

```sh
dsh plugin --profile web add github:winterhuan/dsh-antfarm#v0.3.0
```

For source development:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm test
```

Build before linking this checkout into an isolated profile. Set an independent `DSH_HOME` and point `workspace-controller.config.documentsDirectory` at a temporary directory before opening Web.

```sh
dsh --profile antfarm-dev --from-default-profile web --dump-config > /dev/null
dsh plugin --profile antfarm-dev add link:/Users/winter/dsh-creative/plugins/dsh-antfarm
```

Restart the development service and hard-refresh Web after rebuilding. Remove the layer with `dsh plugin --profile antfarm-dev remove dsh-antfarm`. Daily profiles use the fixed remote release described in the [repository handoff](https://github.com/winterhuan/dsh-creative/blob/develop/HANDOFF.md#5-在-dsh-中安装调试和移除); source edits do not update them.

### Start and inspect

Start from a root Session with a project cwd. Coding teams use Git and GitHub CLI through their original agent instructions; prepare the repository, dependencies and credentials appropriate to the task. The selected workflow authorizes its declared PR actions.

```text
/antfarm run --workflow feature-dev implement payment callbacks
/antfarm fix duplicate callbacks
/antfarm audit authentication
/antfarm workflows
/antfarm list
/antfarm status <runId-or-number>
/antfarm stories <runId-or-number>
/antfarm logs [runId-or-number]
/antfarm cancel <runId> [reason...]
/antfarm resume <runId> [guidance...]
```

The short form `/antfarm <task...>` uses `feature-dev` by default. The model has `antfarm_run`, `antfarm_list`, `antfarm_status`, `antfarm_resume` and `antfarm_cancel`. Run/resume tools wait for the workflow outcome unless `background: true`; commands and panel starts return an admission receipt. All reads and controls check the original root Session owner.

Open **Antfarm** in the right sidebar to select a workflow and inspect its steps, outputs, stories, events and child Sessions. The global workflow board shows explicitly authorized Sessions. Lists use fifty-row pages; visible views refresh, hidden views stop polling, and failed refreshes retain loaded content.

### Recovery and retained files

Resume resets the failed step while retaining completed stories and consumed story retry counts, following original Antfarm. There is no additional retry grant. An interrupted native attempt requires transcript inspection and recovery guidance; the host refuses a second live executor and late results from cancelled attempts. Completed or cancelled runs cannot resume.

Stable agent workspaces live under `$DSH_HOME/antfarm/workspaces/<workflow>/<baseDir>`. Agents receive the owning project directory in their task. Workspaces are retained, and completed loop progress moves into the developer workspace’s `archive/<runId>/progress.txt`. Local edits to managed persona files are preserved and reported when a workflow update conflicts with them; save those edits in the workflow definition before retrying.

Historical per-run JSONL data stays under the configured `journalRoot`. Attributable old runs appear as inspection-only records, with available complete-prefix outputs and native Session links. The executor does not migrate, resume or clean them. Shared agent workspaces have no Run cleanup operation.

### Workflow configuration

Discovery checks `<project>/.antfarm/workflows`, configured `workflowDirs`, then bundled [workflows](workflows/). Custom workflows use original Antfarm YAML and `workspace.files` references for `IDENTITY.md`, `SOUL.md` and `AGENTS.md`. Each agent defines its model, role, deadline, workspace and optional native DSH skill names. Available declared skills load from the owning profile; missing optional skills are disclosed to the agent, matching original provisioning.

The workflow editor saves revision-bound project/user copies and refuses escaped paths or stale source. Running work retains its admitted definition. Install/uninstall controls change availability for new runs; removing an active workflow refuses the operation unless its owned runs are cancelled and drained with force.

Native Plugins settings expose runtime configuration. Structural changes restart the service; uncertain attempts remain interrupted.

| Setting | Meaning |
|---|---|
| `journalRoot` | Historical journal root; original `antfarm.db`, events and workspaces use its parent directory. |
| `workflowDirs`, `defaultWorkflowId`, `subagentProvider` | Registry roots, default team and fresh local execution provider. |
| `maxActiveRuns`, `maxActiveRunsPerOwner`, `dispatchIntervalMs` | Host/owner capacity and model-free readiness polling. |
| `healthEnabled`, `healthIntervalMs` | Periodic diagnostics; `/antfarm health` and ensure-execution also work manually. |
| `gitTimeoutMs`, `subprocessGraceMs` | Native frontend-diff deadline and subprocess termination grace. |
| `webhookTimeoutMs`, `webhookTokenEnv` | Best-effort request deadline and optional environment credential name. |

Workflow `notifications.url` or an explicit Run subscription receives original event fields. URLs omit credentials, query strings and fragments; authentication uses the native environment reference. Delivery failure does not change SQL progress, and host shutdown drains requests.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation and development — click to expand</summary>

The [loader](src/workflow/loader.ts) retains the original workflow documents and persona resources. The [database](src/persistence/database.ts) owns original `runs`, `steps` and `stories` transitions. Additional `dsh_*` tables record owner/Session associations and exclusive native dispatch. `events.jsonl` provides observation and never reconstructs authoritative business state.

The [agent adapter](src/runtime/agents.ts) associates a reserved child ID with a stable persona before native activation. It uses the shared `standard` composition and enforces role policy in visible tools and actual dispatch. DSH owns the model loop, native transcript, parent authority and teardown. [DESIGN](DESIGN.md) explains recovery and ownership; [PARITY](PARITY.md) defines the comparison and verification limits.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Original workflow fixtures](tests/fixtures/original-antfarm/SOURCE.txt)
- [Bundle composition](cordis.patch.yml)
- [Repository integration](https://github.com/winterhuan/dsh-creative/blob/develop/docs/subsystems/antfarm.md)

-----

<a id="model-experience"></a>
## Model Experience

### Workflow tools and child instructions

#### What the model sees

The root model receives five workflow control tools. Each child receives the selected original persona files, declared skill instructions, project path, resolved step input and prior original context. It returns the requested `KEY: value` text. Children cannot start nested Antfarm teams. Run UI queries do not enter model context.

#### Token effect

Full identity, soul and responsibility instructions repeat for each fresh attempt. Prior output, story criteria, progress and verification feedback add task-specific input. Tool results can contain original context and story summaries; inspect long native transcripts separately.

#### KV Cache effect

The identity section follows the shared native prompt. Its content is stable for the same installed agent, while step input and run-specific progress change. Fresh Sessions do not reuse prior conversation history; provider cache reuse depends on matching request prefixes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Each Run executes serially. Stable agent identities permit one active attempt each; multiple runs wait when they share an agent.
- Role policies restrict direct tools. Shell and skill access can still modify files; deployment permissions remain authoritative.
- Original text outputs and PR links remain worker reports. The Host does not independently approve GitHub reviews or attach candidate-bound test evidence.
- Interrupted effects can repeat after explicit recovery. SQLite, fresh Sessions and event logs do not guarantee exactly-once external actions.
- OpenClaw cron installation, dashboard processes and polling-model calls use native DSH equivalents. Default Headless lacks the required preset composition; DSH `0.2.2-rc.1` has no TUI entry.
- [PARITY](PARITY.md#acceptance-scope) separates local mechanism evidence from real-model quality, platform and remote release verification.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The Git release contains prebuilt Host/Web entries and original persona resources. [PARITY](PARITY.md#acceptance-scope) records the validation scope.

</details>
