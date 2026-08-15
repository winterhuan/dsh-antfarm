# dsh-antfarm 设计与实施方案

`dsh-antfarm` 把 [`snarktank/antfarm`](https://github.com/snarktank/antfarm) 的声明式多智能体团队工作流实现为 DeepSeek Harness（DSH）0.1.0-rc.6 的独立自定义插件。仓库可从本地路径、npm 或 GitHub 安装：

```sh
dsh plugin --profile web add /path/to/dsh-antfarm
dsh plugin --profile web add dsh-antfarm
dsh plugin --profile web add github:winterhuan/dsh-antfarm
```

## 1. 目标与保留语义

antfarm 的核心是串行 agent team：一个 run 同时只执行一个 step；loop 每次只处理一个 story；每个 step 使用全新 agent；角色拥有不同工具范围；developer 的结果由独立 verifier 检查；显式失败进入有界重试或升级给人。

移植保留四项行为：

1. workflow 决定 agent、step 顺序、loop、verify 和失败策略。
2. 每次 step/verify/retry 都启动全新子 agent，不继承前一步对话。
3. run context、story 进度和反馈可持久化、fold 和显式 resume。
4. 同一目标仓库可安全并行多个 run，每个 run 默认独占 git worktree。

OpenClaw 的 cron、SQLite claim 队列、medic 轮询和 dashboard daemon 不移植。DSH 的子 agent API 可等待结果；`ctx.jobs` 提供活跃后台任务控制；插件只需一个串行驱动器和持久 journal。

## 2. DSH 集成约束

### 2.1 安装与模块单例

`dsh plugin --profile <name> add <spec>` 把 bundle 安装到 `$DSH_HOME/profiles/<name>` 并加入 profile 的 `dsh.profile.bundles`。bundle manifest 通过 `dsh.bundle.patch` 指向 `cordis.patch.yml`。

DSH、Cordis、jobs、subagent、skills 和 tools 都是宿主单例。`dsh-antfarm` 将它们声明为 `peerDependencies`，并在 `devDependencies` 安装同版本类型与构建依赖。插件不得把第二份 Cordis/DSH runtime 打进 Host bundle。

### 2.2 构建与发布

构建遵循 DSH 的发布产物模型：

- TypeScript 使用 `module: esnext`、`moduleResolution: bundler`、`allowImportingTsExtensions`、`rewriteRelativeImportExtensions` 和严格检查；本地相对导入写 `.ts`。
- `tsc` 生成 `lib/types/**/*.d.ts`；`tsdown` 生成可由普通 Node ESM 加载的 Host bundle 和浏览器 Client bundle。
- Phase 1 package exports 暴露 `.`, `./runtime`, `./tool`, `./invariant`, `./cordis.patch.yml`, `./package.json`;Phase 2 实现完成后才增加 `./commands` 和 `./client`，不发布指向缺失产物的 export。
- `files` 包含 `lib/`、`cordis.patch.yml` 和 `workflows/`。
- GitHub 安装依赖根包 `prepare` 构建；pnpm 阻止 git dependency build 时，用户按 `dsh plugin` 输出把精确包名加入 profile 的 `allowBuilds` 后重试。

### 2.3 rc.6 的持久事件限制

DSH 0.1.0-rc.6 能读取带 `ignorable:true` 的未知 session event，但 `Session.append()` 尚无写入该标记的参数。out-of-tree 插件若直接追加 `antfarm/*` 自定义事件，未安装插件的第一方读取器会拒绝恢复该会话。

因此 Phase 1 不把自定义 run 事件写入 DSH Session 日志。插件自有 append-only JSONL journal 是 run 的持久真相；DSH Session 只保留第一方已知的 tool/job/subagent 记录和 model-visible tool result。未来 DSH 提供 ignorable 写入 API 后，可以增加 Session 投影，但 journal 仍是迁移前后兼容的持久来源。

## 3. 仓库和包结构

仓库使用一个可安装 npm bundle 包，避免 workspace 子包在本地/GitHub 安装时无法独立解析或尚未发布：

```text
dsh-antfarm/
  package.json
  pnpm-lock.yaml
  tsconfig.json
  tsdown.config.ts
  cordis.patch.yml
  README.md
  DESIGN.md
  src/
    index.ts             # bundle Host 空入口
    runtime/             # ctx.antfarm service + registry + orchestrator
    tool/                # antfarm_run / antfarm_list
    commands/            # /antfarm status|cancel|resume（Phase 2）
    persistence/         # JSONL journal + fold + reconciliation
    workspace/           # git worktree + coordinator Agent
    client/              # Studio/run UI（Phase 2）
    invariant.ts
  workflows/
    shared/{setup,verifier,pr}/{IDENTITY,SOUL,AGENTS}.md
    feature-dev/workflow.yml
    feature-dev/agents/...
    bug-fix/...          # Phase 2
    security-audit/...   # Phase 2
  tests/
```

`cordis.patch.yml` 挂载同一包的不同 Host 子入口；Phase 2 再加入包自身的 `dsh.client` 行。单包内部按模块边界组织，只有出现独立发布或独立演进需求时再拆 npm 包。

## 4. 配置模型

### 4.1 workflow 与 agent 文件

YAML 和 Markdown 是唯一配置真相。内置与用户工作流走同一加载器，不维护 TS spec 副本。

发现根按优先级从高到低：

1. `<project-root>/.antfarm/workflows`
2. `$DSH_HOME/antfarm/workflows`
3. `Config.workflowDirs[]`
4. 包内 `workflows/`

同名 workflow 由高优先级根覆盖。每个 workflow 目录包含 `workflow.yml` 和可选 `agents/<id>/{IDENTITY,SOUL,AGENTS}.md`。`extends: shared/<id>` 在加载时解析；运行时只接收完整、自包含、已校验的 workflow spec。

加载器启动时扫描；Phase 1 每次 `run` 前重载目标 workflow，保证文件编辑无需重启。文件 watch/HMR 放 Phase 2。

### 4.2 schema

```text
workflow: id, name, version, description, agents[], steps[]
agent:    id, name, role, model?, timeoutSeconds?, skills?, extends?
step:     id, agent, type(single|loop), input, expects?, maxRetries?, onFail?
loop:     over(stories), completion(all_done), freshSession, verifyEach?, verifyStep?
onFail:   retryStep?, maxRetries?, onExhausted.escalateTo?
story:    id, title, description, acceptanceCriteria[], maxRetries?
```

解析阶段校验：唯一 id、agent/step 引用、verifyStep/retryStep 存在、retryStep 指向当前步骤之前、verifyStep 不能引用自身、loop 只能引用 stories、persona 文本不能含未解析 `{{…}}`、模板引用在对应阶段可满足。

### 4.3 agent 内容映射

| 配置内容 | DSH 输入 |
|---|---|
| `IDENTITY.md` + `SOUL.md` | `SubagentStartRequest.persona`，遮蔽部署 persona |
| `AGENTS.md` | 子 agent task 的操作指令前置 |
| step `input` | 子 agent task 正文 |

persona 不使用 complete 模式，子 agent 仍需宿主工具说明和 runtime context。persona 只允许静态文本；AGENTS/input 的 `{{…}}` 由 antfarm 模板解析器处理，缺 key 在启动 child 前失败。

### 4.4 skills

`skills` 是允许列表，不是新的技能存储。每次 step 启动前用 `ctx.skills.get(name,{cwd,scope,parent,signal})` 验证声明技能存在且可供模型调用，并把声明技能及使用要求放入 task。

DSH rc.6 没有现成的“仅显示 agent 声明 skills”过滤器；全局 `skill` 工具仍可能看到其他可用技能。因此 Phase 1 的 `skills` 是验证与提示约束，不承诺安全隔离。真正的 per-child skill catalog restriction 需要 DSH 新扩展点或 scoped provider，放入开放问题。

### 4.5 role 与工具限制

默认映射由 `Config.roleToolRestrictions` 可覆盖。工具表按 agent scope 组合，Host load 时无法可靠验证名称；`tools.restrict()` 在 step child creation window 校验，未知工具导致该 step fail loud：

| role | 默认 ToolRestriction |
|---|---|
| `analysis` | deny `write`,`edit`,`bash` |
| `coding` | 不过滤 |
| `verification`,`testing`,`pr`,`scanning` | deny `write`,`edit`，保留 `bash`,`skill` |

允许 bash 的角色仍能通过命令写文件；ToolRestriction 只移除直接写工具，不是文件系统只读安全边界。需要真正只读时必须使用 DSH sandbox policy；Phase 1 文案和测试不得把 verification 称为“不可写”。

## 5. 工作区隔离

### 5.1 默认 worktree

一个 run 独占一棵 git worktree：

1. 校验 base cwd 是 git 工作树，并记录 repo root、base revision 和原始状态。
2. 检查 `<repo-root>/.worktrees` 未被跟踪；若未被忽略，则在本地 `.git/info/exclude` 增加 `/.worktrees/`，不修改项目 `.gitignore`。
3. 创建分支 `antfarm/<runId>` 和 `<repo-root>/.worktrees/antfarm/<runId>`。
4. 在 worktree 中创建 `.antfarm/progress-<runId>.md`；setup 负责安装依赖、复制显式允许的环境文件并建立 build/test 基线。
5. 所有 step child 的 SessionHeader.cwd 必须是该 worktree。
6. completed/cancelled 仅在 worktree clean 时自动 remove；dirty/untracked、failed、blocked、interrupted 一律保留并记录 `workspace-retained`。自动清理不使用 `--force`，只操作 journal 明确拥有的 worktree。

分支在 planner 前创建，不依赖 planner 输出的 `BRANCH`。workflow 的 `{{branch}}` 使用编排器生成的分支名；planner 不再拥有 checkout/branch 决策。

### 5.2 run coordinator Agent

`SubagentStartRequest` 没有 per-call cwd，spawn child 固定继承 parent SessionHeader.cwd。编排器不能直接把原调用方 Agent 作为 step parent，否则 child 仍在 base cwd。

每个 active run 通过公开 `ctx.agents.create()` 建立一个不执行模型轮次的 coordinator Agent：

- coordinator SessionHeader.cwd=run worktree；parentSession 指向调用方 Session；origin=`subagent`。它的 delegation depth 与原 parent 相同，因为 coordinator 不执行模型委派；step child spawn 时才增加一次。
- creation setup 调用 DSH 公开的 `applyChildComposition()` 和 `appendDelegatedPolicyOverrides()`，继承调用方 preset、sandbox override 与 approval=never 规则。
- 所有 step 用 coordinator 作为 `ctx.subagents.start()` 的 parent，自然继承 worktree cwd。
- coordinator handle 由 run lifecycle 独占；run 停止后 dispose，确保 Agent、Session 和 scoped registrations 清理。
- coordinator 是 rc.6 的 cwd compatibility adapter，封装在 workspace 模块；DSH 提供 per-child cwd 后可替换，不进入 workflow 业务模型。

coordinator Session 不承载 run 真相；恢复时由 journal 重建 run，再创建新的 coordinator。

### 5.3 shared 模式

`isolation:'shared'` 直接使用 base cwd，按 realpath 建互斥锁。同 cwd 第二个 active run fail loud。shared 模式不会自动 checkout planner 指定分支，也不保证回滚用户未提交修改；工具结果必须明确标记这一限制。

## 6. 执行状态机

`ctx.antfarm.start({workflowId,task,parent,cwd?,provider?,model?,isolation?,signal?})` 先完成 workflow/cwd/provider 前置校验并预留 runId、branch、workspace path，再同步注册 owner=`parent`、kind=`antfarm` 的 `ctx.jobs` 作业。job starter 创建独立 AbortController；tool-call `signal` 只拥有提交前启动，工具返回后由 job cancel 拥有整个 run。worktree、coordinator 与 journal 在 job-owned async `done` 中创建；工具立即返回 `runId`,`jobId`,`workspace`,`branch`，后续创建失败表现为 job failed。

单 run 只有一个 driver：

1. 从 journal fold 得到 program counter、context、stories、retry 计数和反馈。
2. 解析 persona、AGENTS 和 step input，校验 skills/tool restriction。
3. `ctx.subagents.start('spawn',{parent:coordinator,prompt,persona,toolFilter,agentOptions,signal})`。
4. await result，确保 `SubagentRun.dispose()`；按 `stopReason`、`expects` 和 KEY:value/STORIES_JSON 解析提交 journal event。
5. 成功推进下一 step；失败按 step 类型进入本地 retry、verify 子循环、顶层 retryStep 或 blocked/failed。
6. deadline 通过组合 AbortSignal 取消 child；只有 child 和资源达到 quiescence 后 job 才终结。

### 6.1 输出解析

Phase 1 兼容 antfarm 文本协议：

- 只解析行首 `KEY: value`；键必须是 spec 已知输出或保留键。
- `STORIES_JSON` 必须是 JSON 数组并经过 story schema 校验。
- `expects` 是明确的完整行/固定 token 匹配，不做任意 substring；feature-dev 使用 `STATUS: done` 和 `STATUS: retry`。
- 解析后只把最小 `contextDelta` 写入 journal；子会话完整文本留在 DSH 自身 Session。

structured output 是后续加固，不是 Phase 1 前提。

### 6.2 verify_each 子循环

loop 每个 story 串行执行：

```text
for first non-done story ...:
  implement(current_story, verify_feedback)
  if verifyEach:
    verify(current_story, changes)
    done  -> story.done; next story
    retry -> story.retryCount++; feedback=ISSUES; rerun current story
  else:
    story.done
```

retry 只重跑当前 story。每个 story 有独立 retryCount/maxRetries；超过上限时按 verify step 的 `onExhausted` 进入 blocked 或 failed。作为 `verifyStep` 调用时，verify 自身的 `onFail.retryStep` 不参与；子循环优先且语义唯一。

### 6.3 顶层 retryStep

顶层 single step（例如 test/review）失败时，`onFail.retryStep` 创建有界反馈回路。失败步拥有自己的 retry 计数；耗尽走 `onExhausted`。

若 retry target 是 single step，program counter 回到 target，后续步骤按顺序重跑。

若 retry target 是已完成的 loop step，不重置已 done stories，也不让 loop 空转；编排器执行一次明确的 `repair pass`：使用 loop agent，以失败步反馈、完整 story 摘要和当前 diff 作为 task，不绑定某个 story。repair 成功后直接重跑失败步。workflow loader 要求此类 loop target 提供 `repairInput` 模板；缺失即配置错误。这样 test/review→implement 有可执行语义，而不是依赖 antfarm 原实现的含糊状态重置。

### 6.4 blocked、failed 与 cancelled

- 显式失败且有 `escalateTo: human`：追加 `run-blocked`，job 完成但 run 非终态；保留 worktree。
- 重试耗尽且无 escalation：追加 `run-end(failed)`；保留 worktree。
- 用户取消：取消当前 child，等待 quiescence，追加 `run-end(cancelled)`；worktree clean 才清理，否则追加 `workspace-retained`。
- 成功：追加 `run-end(completed)`；worktree clean 才清理，否则追加 `workspace-retained`；分支始终留在 base repo。

## 7. JSONL journal、fold 与恢复

### 7.1 存储位置和事件

默认路径：`$DSH_HOME/antfarm/runs/<runId>/events.jsonl`。同目录保存 `meta.json`（只含快速定位字段，不是状态真相）和可选诊断输出。每行一个带 `version`, `seq`, `time`, `type`, `data` 的 lossless JSON event；append 后在承诺已启动/blocked/resume/terminal 的 API 返回前 flush。

事件：

- `run-start`:runId、ownerSessionId、baseCwd、worktree、branch、baseRevision、isolation、task、**resolvedWorkflowSnapshot**。
- `stories-registered`。
- `step-start` / `step-end`:stepId、attempt、storyId?、outcome、contextDelta、feedback?、childSessionId?。
- `run-blocked`:失败位置、原因、feedback。
- `run-resume`:authority、guidance、恢复位置。
- `run-end`:completed/failed/cancelled、error?。
- `workspace-cleaned` / `workspace-retained`（含 dirty 状态或清理失败原因）。

run-start 固化解析后的 workflow 快照；后续 YAML 修改不改变已存在 run 的恢复语义。新 run 才使用新 spec。

### 7.2 fold

fold 是纯函数，按 seq 重建：context、stories、step/story attempts、当前 program counter、blocked/interrupted/terminal、workspace 状态。读取器拒绝未知 journal version、seq 不连续、runId 不匹配和非法 JSON；不跳过损坏行。

`step-start` 无配对 `step-end` 的步骤在重启后标记 interrupted，resume 时用全新 spawn 重跑；shutdown abandonment 不增加业务 retryCount。

### 7.3 reconciliation 与 resume

插件加载时扫描 `$DSH_HOME/antfarm/runs/*/meta.json`，只读取非终态候选的 journal，重建 resumable registry；不自动启动模型工作。

`resume(runId,authority,guidance?)` 必须：

1. fold journal 并拒绝 terminal/active run。
2. 校验调用者 session 是 run owner session 或其授权祖先；Phase 1 只允许原 owner Agent 调用。
3. 校验 worktree 仍存在且 HEAD/branch 与 journal 一致；不自动覆盖人工修改。
4. 创建新 coordinator，追加 `run-resume`，从首个非 done story、pending step 或 repair pass 继续。

Phase 1 实现进程内 start/cancel/fold 与 interrupted 检测；显式跨重启 resume 命令和完整 authority 放 Phase 2。Phase 1 不声称完成跨重启恢复。

## 8. tool、commands 与模型体验

### 8.1 Phase 1 tools

- `antfarm_run`:参数 `workflow_id`,`task`,`cwd?`,`provider?`,`model?`,`isolation?`;成功返回 runId/jobId/workspace/branch/status。工具只在 `ctx.jobs` 已为 caller 配置 controller 时启动后台 run。
- `antfarm_list`:列出调用方可见 active/resumable run 的有界摘要；不返回完整 workflow/persona/journal。

工具提示说明：antfarm 用于用户明确要求的团队工作流；普通单次委派仍用 subagent；run 在后台执行，状态由 job 工具或 antfarm_list 查询。

### 8.2 Phase 2 commands

`/antfarm run|list|status|cancel|resume|cleanup` 是人类入口。命令和工具调用同一 `ctx.antfarm` 服务，不复制编排逻辑。

## 9. medic 与可视化

### 9.1 medic

不移植独立 medic daemon。其职责分解为：step deadline、single-driver、journal fold/reconciliation、workspace 一致性检查、job lifecycle 和显式 status/cleanup。Phase 2 增加启动诊断摘要，但不周期唤醒冷 run。

### 9.2 Antfarm Studio（Phase 2）

Studio 有三个视图：

1. **Runs**：会话 run 节点 + 按 base repo 聚合的项目级总览；显示 step/story、attempt、耗时、blocked feedback、worktree/branch，并可下钻 child transcript。
2. **Workflow**：读取 workflow.yml，显示串行 step、loop/verify/retry 边；编辑器写回 canonical YAML，不保存私有格式。
3. **Agents**：编辑 IDENTITY/SOUL/AGENTS、role/model/timeout/skills，预览最终 persona 与 task 组合，并提示 role 与指令冲突。

YAML+Markdown 始终是配置真相；journal 是 run 真相。UI 不把编辑状态或 run 状态另存成第三份业务数据。

Client 通过包的 `dsh.client` manifest 和 `./client` bundle 加载。Slot 名、props、host RPC 和 workspace/session frame 投影在 Phase 2 实现前必须通过 DSH Inspect/源码确认；不在 Phase 1 预设私有 API。

## 10. 配置

Host runtime Config 至少包含：

```text
workflowDirs: string[]
journalRoot: string                    # 默认 dshHomePath('antfarm/runs')
worktreeDirectory: string              # 默认 .worktrees/antfarm，相对 repo root
defaultIsolation: worktree|shared      # worktree
defaultStepTimeoutSeconds: number      # 1800
subagentProvider: string               # spawn
maxActiveRunsPerOwner: number
roleToolRestrictions: record<role,ToolRestriction|null>
envFiles: string[]                     # 默认空；显式允许复制到 worktree
cleanupCompletedWorktrees: boolean     # true
cleanupCancelledWorktrees: boolean     # true
```

journalRoot 由 `cordis.patch.yml` 使用 DSH 的 `dshHomePath()` 注入绝对值；worktreeDirectory 在 repo root 下解析且不得逃出该目录。所有部署可调值都经过 schemastery 校验；非法 workflow root、缺服务和无 spawn persona/toolFilter capability 在最早可判定点失败，role restriction 中的工具名在目标 step 的 child creation window fail loud。

## 11. 分阶段实施与验收

### Phase 1A：可安装的垂直切片

交付：单包 Host bundle、构建/exports、Config、workflow loader、独立 `smoke` workflow（一个 single step，不冒充 feature-dev）、JSONL journal/fold、项目内 worktree+coordinator、后台 job、`antfarm_run/list`、bundle patch。

验收：

1. `pnpm install && pnpm build && pnpm test`。
2. `dsh plugin --profile antfarm-dev add /absolute/path/to/dsh-antfarm` 成功，profile 能 boot。
3. keyless REAL-composition 测试从真实 cordis.yml 启动插件，验证 workflow 发现、journal commit、job settlement、tool result 和 fiber dispose。
4. 使用 mock provider 跑完 `smoke` run；child session cwd 等于 worktree realpath；clean worktree 被清理，dirty worktree 被保留且 journal 记录原因。

### Phase 1B：antfarm 核心语义

交付：完整 feature-dev、STORIES_JSON、loop、verify_each、story retry、顶层 retryStep repair pass、deadline、blocked、cancel、shared cwd mutex、角色/skills 校验。

验收：状态机/解析/fold/worktree 单测 + 真实组合测试；最小成功、verify retry 后成功、retry 耗尽 blocked、取消四条路径均有固定 journal 和 tool/job 结果。

### Phase 2：恢复、人类入口和 UI

交付：完整跨重启 reconciliation/resume、commands、cleanup、bug-fix/security-audit、Studio Runs/Workflow/Agents、项目级总览、文件 watch。

验收：重启前中断、重启后显式 resume 不重跑 done story；GUI 组件测试、真实 Web replay、Playwright 桌面/移动截图和 GIF；Client stop/update 后 Slot 与订阅全部卸载。

### Phase 3：兼容与加固

交付：antfarm YAML 兼容性报告/导入器、structured output 可选模式、journal schema 迁移工具、DSH 提供 ignorable writer 后的 Session 投影、per-child skill catalog restriction（若宿主扩展点具备）。

## 12. 测试与发布

- 单元测试：schema、template、文本输出解析、fold、state transition、retry budget、worktree、mutex、journal 损坏拒绝。
- 真实组合测试：通过 Cordis Loader 启动 bundle 行，使用 mock subagent/provider 和真实 jobs/session/agent service，验证 model-visible、durable 和 disposal 行为。
- npm 检查：`publint`、`npm pack --dry-run`、Node plain-ESM import smoke、exports 每个 Host 子入口 smoke。
- CI：Node 22.19 与 24；install、typecheck、lint、test、build、pack smoke。
- peer 版本：Phase 1 精确支持 DSH `0.1.0-rc.6`；在未验证 rc.7 前不声明宽泛兼容。

## 13. 外部要求与已知限制

- 默认 worktree 需要 git；`gh` 仅 pr agent 需要并已认证；`agent-browser` 是可选 skill/CLI。
- worktree 不包含未跟踪文件；只复制 Config 明确列出的 env 文件，绝不默认复制全部 secrets。
- verifier/tester 保留 bash 时不是文件系统只读。
- rc.6 的 out-of-tree session event 不能安全持久化，run 状态使用插件 JSONL journal。
- Phase 1 的 skill 列表是验证与提示约束，不是隔离边界。
- GitHub 仓库独立发布；实现不依赖 DeepSeek Harness monorepo 内的源码路径或自定义插件目录。
