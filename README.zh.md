---
description: "可复用团队工作流、候选验收、工作流配置与原生 DSH 运行控制。"
kind: "package-bundle"
---

# dsh-antfarm

[English](README.md) | 中文

## 摘要

通过可复用专业工作流完成开发、缺陷修复、安全整改、研究和写作。编辑工作流副本，在原生 DSH 侧栏和工作流看板检查成果并控制运行。已接受进度跨重启保留，不确定效果需要人工核对。此开发检出面向 DSH `0.2.2-rc.1`，使用隔离 profile 安装。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

Antfarm 是可安装的 profile 层，提供工作流工具、`/antfarm` 命令、六个 Agent Preset、可控制运行的 Runs 标签页与工作流看板。需要 Node.js `^22.19 || >=24`、pnpm `11.7.0`、Git 与 DSH `0.2.2-rc.1`。

使用包含原生 Agent Preset 组合的 Web 或 TUI profile。默认 headless profile 缺少 Agent Preset 注册器和 parent preset；自定义 headless profile 必须先提供两者，再安装本 bundle。

### 安装到开发 profile

先构建此检出，再链接其根目录。使用独立 `DSH_HOME` 与 profile；打开 Web 前，将 `workspace-controller.config.documentsDirectory` 指向临时目录。远程当前 `main` 与已有 `0.1.0` 发布尚不包含此开发实现；远程安装需要新验收并固定提交的发布包。

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm test
```

在隔离环境使用 `dsh plugin --profile antfarm-dev add link:/absolute/path/to/dsh-antfarm`。重新构建后重启开发服务并硬刷新 Web。使用 `dsh plugin --profile antfarm-dev remove dsh-antfarm` 移除该层。[cordis.patch.yml](cordis.patch.yml) 共同激活全部 Host 与 Client 入口。检出中的修改不会更新日常 profile。

### 启动与查看运行

编码工作流从 cwd 属于非裸 Git 仓库且仓库已有提交的会话发起。研究和写作使用 `workspace: files`，也能在 Git 之外运行。模型可向 `antfarm_run` 传入 `task`、可选 `workflow_id` 与 `background`；默认工作流为 `feature-dev`。运行和恢复工具默认等待最终接受、失败或阻塞状态；`background: true` 返回后台准入结果。斜杠指令与面板启动返回包含运行／任务标识和所属工作区的持久回执，执行继续进行。

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

简写 `/antfarm <task...>` 使用默认工作流。`fix`、`audit`、`smoke` 分别选择 `bug-fix`、`security-audit`、`smoke`。任务正文以保留命令词开头时使用 `run`。模型还可使用 `antfarm_list`、`antfarm_status`、`antfarm_cancel`、`antfarm_resume`、`antfarm_cleanup`；所有入口均校验发起会话的所有权。

从 Web 右侧栏打开 **Antfarm**，选择工作流、描述任务并检查运行。在全局 **Antfarm 工作流看板**按工作流和当前阶段查看已授权会话。列表每页加载五十次运行，展示稳定编号、任务、已接受 story 进度、输出、候选检查、保留文件、事件和原生子会话链接。可见视图持续刷新，包括空列表和已完成列表；隐藏视图停止轮询。查询失败保留已加载内容。

### 恢复与保留输出

Host 启动会恢复原始且未归档根会话的原生权限，无须父模型回合即可调度已保存的安全工作。未结算尝试保持中断。由所属会话恢复阻塞、中断或失败运行；失败运行需要显式追加重试预算。已接受检查点保留 done stories 和成功摘要；失败输出保留为反馈。恢复使用保存的工作流快照，因此 YAML 编辑只影响新运行。

未完成的尝试表示子会话效果不确定。查看其记录与保留 worktree 后，向 `resume` 提供明确核对指导。全新子会话可能重复最后一个已接受检查点之后的文件系统或外部效果。Antfarm 不保证恰好执行一次。GitHub 阶段在接受交付前查询 PR head 与已发表批准审查。恢复拒绝已完成/取消或已清理运行、并发写入者、仓库身份变化、改变/游离的分支，以及不再继承记录中基准提交的 HEAD。

每个 worktree 从捕获的仓库 `HEAD` 开始，不包含基础检出未提交、未跟踪和忽略文件。Antfarm 不复制环境文件。通过部署机制准备所需依赖与凭据；worktree 不是笔记本工作目录的副本。

完成和取消运行在配置启用时尝试清理。清理仅移除身份已校验且没有已跟踪修改、未跟踪文件或忽略文件的 worktree，并保留分支。失败与阻塞运行保留输出。清理前保存输出；阻塞/中断运行先取消再清理。身份变化与 Git 错误会保留目录并记录原因。

### 配置工作流与 presets

发现依次查找 `<repo>/.antfarm/workflows`、按配置顺序的 `workflowDirs`，最后查找包内 [workflows](workflows/)。bundle 将 `$DSH_HOME/antfarm/workflows` 作为配置目录。使用 `version: 2` YAML 与相对 Markdown 指令；[smoke](workflows/smoke/workflow.yml) 是最小示例。

每个 agent 选择部署提供的 `preset` 和一个 `instructions` 文件，可选 `model` 与 `timeoutSeconds`。bundle 安装 `antfarm-analysis`、`antfarm-coding`、`antfarm-verification`、`antfarm-testing`、`antfarm-scanning` 和 `antfarm-pr`。Analysis 不提供 shell 并关闭直接写工具；verification 关闭直接写工具但保留 shell 执行测试。能使用 shell 或 skill 的角色并非文件系统只读。worktree 之外的访问受 DSH 权限与 sandbox 管理。

### 工作流副本与生效设置

在 **配置工作流**检查生效来源，编辑 YAML 或角色 Markdown，校验后保存项目或用户覆盖。项目定义优先于配置的用户目录和包内工作流。创建项目副本可选择新 id，移除覆盖可恢复继承。保存比较来源修订并拒绝竞争修改。未保存草稿保留至面板和会话导航之后；刷新浏览器前需要放弃或保存草稿。

通过 `/antfarm install <id|all>`和 `/antfarm uninstall <id|all> [--force]`调整项目启用状态。卸载会拒绝仍依赖它的活跃工作；`--force`取消并等待这些工作退出。资源与 Run 证据继续保留。通过 `/antfarm import <directory> <sourceRoot> [--files]`导入原版定义；明确选择的来源根目录必须包含全部共享角色文件。

DSH 原生插件设置编辑 `antfarm-runtime`配置。默认值和清理设置由新 Run 捕获；结构性配置变化重启服务并中断不确定工作。Host/owner 容量限制执行数量，不限制持久准入。

| 设置 | 用途 |
|---|---|
| `defaultWorkflowId`、`defaultStepTimeoutSeconds` | 默认工作流与尝试截止时间 |
| `maxActiveRuns`、`maxActiveRunsPerOwner` | Host 与 owner 执行容量 |
| `maxAttempts`、`maxStories`、`maxStoryRetries` | 有界工作量的部署上限 |
| `healthEnabled`、`healthIntervalMs` | 不调用模型的健康检查及其间隔 |
| `webhookUrl`、`webhookTokenEnv` | 显式生命周期订阅与原生环境凭据引用 |
| `githubReviewerTokenEnv` | 可选的独立 GitHub 审查身份凭据引用 |

文件工作流在准入时捕获声明的 UTF-8 `inputs`，在所属 `.antfarm/runs/<runId>`目录产出文件。输出按摘要保留快照，显式清理前后均可预览/下载，原输入文件不改变。GitHub 工作流阶段声明创建 PR 和批准审查。选择这些工作流即授权其声明的交付操作，合并需要另行授权。自审、缺少浏览器能力或未确认远程效果都会阻止验收。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现与开发 — 点击展开</summary>

[运行时](src/runtime/index.ts) 管理所属会话的操作准入与租约日志写入者。[执行器](src/runtime/orchestrator.ts) 使用 preset、cwd、指令与结构化输出执行串行 DSH 子会话。完整检查点一次接受规划 stories 与游标，或一个成功步骤/story 结果。必需检查引用同一候选上的实际原生 shell 执行，修复会使最终检查失效。原生 DSH 保存会话记录；Antfarm 保存业务进度。

日志默认位于 `$DSH_HOME/antfarm/runs/<runId>/events.jsonl`。[日志](src/persistence/journal.ts) 刷盘 version 3 记录；[fold](src/persistence/fold.ts) 重建已接受状态。可识别 owner 的不支持/损坏证据仅供查看，不能恢复或清理。Antfarm 不向原生 Session 日志追加私有事件。

worktree 默认位于 `<repo>/.worktrees/antfarm/<runId>`，分支为 `antfarm/<runId>`。[工作区模块](src/workspace/git.ts) 将配置目录加入仓库本地 Git exclude，校验规范路径与 Git 身份，通过 DSH subprocess 执行 Git。它不会强制移除 worktree 或删除分支。

提交前运行 `pnpm run typecheck`、`pnpm run build`、`pnpm test`。`pnpm run check:package` 还会构建、运行 `publint`、执行 npm pack dry run，并通过普通 Node ESM 导入 Host 入口。Client 使用 DSH 浏览器加载器与生成的 `dsh-antfarm/remote`，不是普通 Node 入口。真实 DSH 与模型/网络验收需要独立于单元测试完成。

</details>

-----

<a id="further-exploration"></a>
## 进一步阅读

[DESIGN.zh.md](DESIGN.zh.md) 说明检查点、重试、取消与资源所有权。[cordis.patch.yml](cordis.patch.yml) 定义 presets 与服务。[package.json](package.json) 定义精确 DSH 版本与构建 exports。

-----

<a id="model-experience"></a>
## 模型体验

### 工作流工具与子代理指令

#### What the model sees

发起模型看到六个工作流控制工具，包括 `antfarm_run`。子会话无法访问这些工具或启动工作流。每个新子代理接收角色 preset、项目指令、解析后的步骤输入、已接受的前序结果，以及原生 `structured_output` 要求。Bash 结果提供执行引用，供结构化检查使用。`antfarm_status` 展示原因和最近最多三个已接受输出，每项限制为 2,000 字符。Runs UI 读取不进入模型上下文。

#### Token effect

角色指令和工具 schema 提供稳定的提示文本。步骤输入、story 反馈、已接受摘要和人工恢复指导会为每个子代理增加有界的运行上下文。

#### KV Cache 影响

bundle 不增加请求前缀。Presets 提供指令；每个全新子会话接收步骤上下文与输出 schema。

## 已知限制与待办

<a id="known-limitations-and-deferred-work"></a>

- 单次 Run 串行执行。Host 默认最多八次尝试，每个 owner 最多两次；已准入工作在持久队列等待。
- worktree 隔离检出内容，不隔离 shell、网络、凭据或外部效果。
- 原版 YAML/Markdown 工作流可导入；旧 Run 日志保持只读。不支持共享执行目录与自动环境复制。
- 看板包含明确授权的根会话。归档 owner 需要先恢复所属会话才能继续执行。
- 默认 `spawn` provider 必须支持全新本地 preset、结构化输出与 Agent options；继承父上下文的 provider 被拒绝。
- GitHub 发布/审查、浏览器检查、真实模型质量与远程安装需要独立验收证据。本地确定性测试不能证明这些结果。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

本文定义开发实现，不是发布或验收报告。发布前记录实际命令退出码与浏览器证据。安装入口要求当前构建与隔离 DSH 验收。

</details>
