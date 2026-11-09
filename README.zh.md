---
description: "原版 Antfarm 团队、人设身份、SQLite 进度与原生 DSH 运行控制。"
kind: "package-bundle"
---

# @winterhuan/dsh-antfarm

[English](README.md) | 中文

## 概述

在 DSH 中运行原版功能开发、缺陷修复和安全审计团队。每位专家保留独立身份、人设与工作区，每次尝试创建全新 Session。在工作流看板配置 Agent、启动任务并查看步骤输出、故事与原生会话记录。版本 `0.3.3` 对应 DSH `0.2.2-rc.1`，并保留历史 `0.2.0` 运行供检查。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [继续探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

### 安装与开发

使用 Node.js `^22.19 || >=24`、pnpm `11.7.0` 和 DSH `0.2.2-rc.1` Web profile；宿主需提供原生 `standard` Agent Preset 与本地 `spawn` provider。此组合包增加五个工作流工具、`/antfarm` 命令、Session 侧栏和工作流看板，不注册 Antfarm 角色 preset。

将不可变发布标签安装到 Web profile：

若此 profile 已安装无 scope 的 `dsh-antfarm`，先使用 `dsh plugin --profile web remove dsh-antfarm` 移除旧安装层，再安装带 scope 的发布包。

```sh
dsh plugin --profile web add github:winterhuan/dsh-antfarm#v0.3.3
```

源码开发使用：

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm test
```

先构建，再将此检出链接到隔离 profile。打开 Web 前设置独立 `DSH_HOME`，并将 `workspace-controller.config.documentsDirectory` 指向临时目录。

```sh
dsh --profile antfarm-dev --from-default-profile web --dump-config > /dev/null
dsh plugin --profile antfarm-dev add link:/Users/winter/dsh-creative/plugins/dsh-antfarm
```

重新构建后重启开发服务并硬刷新 Web。使用 `dsh plugin --profile antfarm-dev remove @winterhuan/dsh-antfarm` 移除此层。日常 profile 使用[仓库交接](https://github.com/winterhuan/dsh-creative/blob/develop/HANDOFF.md#5-在-dsh-中安装调试和移除)中记录的固定远程发布包；源码修改不会更新日常安装。

### 启动与查看

在左侧打开 **Antfarm 工作流看板**，选择具有项目 cwd 的根会话，再选择工作流并填写任务。默认显示功能开发团队；也可以选择缺陷修复或安全审计。查看团队后点击 **启动运行**，无需输入命令或打开右侧栏。

展开团队中的 Agent，可编辑名称、模型、超时和人设文件。点击 **校验并保存** 后启动，新任务使用保存的配置；模型留空时继承工作流模型或 DSH 默认模型。完整 YAML、保存位置、复制和移除覆盖副本位于 **高级配置**。

也可以从具有项目 cwd 的根 Session 使用以下命令启动。编码团队按照原版 agent 指令使用 Git 与 GitHub CLI；请准备任务所需的仓库、依赖与凭据。所选工作流包含其声明的 PR 操作。

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

简写 `/antfarm <task...>` 默认使用 `feature-dev`。模型拥有 `antfarm_run`、`antfarm_list`、`antfarm_status`、`antfarm_resume` 和 `antfarm_cancel`。Run/resume 工具等待工作流结果，除非设置 `background: true`；命令和面板启动返回准入回执。所有读取与控制均检查原根 Session 的归属。

全局看板展示明确授权的会话及运行；没有运行时仍显示团队和启动表单。也可以打开右侧栏的 **Antfarm**，配置团队、启动并查看步骤、输出、故事、事件和子 Session。列表每页五十条；可见视图刷新，隐藏视图停止轮询，刷新失败时保留已加载内容。

### 恢复与保留文件

Worker 必须返回明确的 `STATUS: done`、`STATUS: retry` 或 `STATUS: failed`。成功回复须包含步骤的 `expects` 文本；缺失状态、格式错误和执行失败消耗现有重试预算。Story verifier 的 `retry` 重做当前故事；其他步骤的 `retry` 停止运行并保留反馈，修正问题后恢复该步骤，不自动回退到其他步骤。恢复指导、上次失败反馈及已有的构建／测试基线进入后续尝试输入。

恢复按原版 Antfarm 重置失败步骤，保留已完成故事和已消耗的故事重试次数，不使用追加重试授权。中断的原生尝试需要先查看会话记录并提供恢复指导；宿主拒绝第二个活跃执行器和已取消尝试的迟到结果。已完成或已取消的运行不能恢复。

稳定 agent 工作区位于 `$DSH_HOME/antfarm/workspaces/<workflow>/<baseDir>`。Agent 在任务中收到所属项目目录。工作区会保留，完成循环后的进度移入 developer 工作区的 `archive/<runId>/progress.txt`。模板未变时保留并加载人设文件的本地学习记录；只有模板和本地文件同时变化且内容不同时才阻止尝试。解决冲突时，将合并后的内容同时保存到工作流定义和工作区文件。工作区按身份共享，项目特有经验须标明项目。

历史的逐 Run JSONL 数据保留在配置的 `journalRoot` 下。可确认归属的旧运行以只读记录展示可用完整前缀中的输出与原生 Session 链接。执行器不迁移、恢复或清理这些记录。共享 agent 工作区不提供逐 Run 清理操作。

### 工作流配置

发现顺序为 `<project>/.antfarm/workflows`、配置的 `workflowDirs`、包内[工作流](workflows/)。自定义工作流使用原版 Antfarm YAML，通过 `workspace.files` 引用 `IDENTITY.md`、`SOUL.md` 和 `AGENTS.md`。各 agent 定义模型、角色、时限、工作区和可选原生 DSH skill 名称。声明的可用 skill 从所属 profile 加载；缺失的可选 skill 会告知 agent，与原版安装行为一致。

工作流编辑器保存绑定修订的项目或用户副本，拒绝逃逸路径或过期源码。正在运行的任务保留准入时的定义。安装或卸载控制影响新运行的可用性；移除活跃工作流会被拒绝，除非通过 force 取消并排空所属运行。

原生插件设置提供运行时配置。结构配置变化会重启服务；不确定尝试保留为中断状态。

| 设置 | 含义 |
|---|---|
| `journalRoot` | 历史日志根；原版 `antfarm.db`、事件与工作区使用其父目录。 |
| `workflowDirs`、`defaultWorkflowId`、`subagentProvider` | 注册目录、默认团队与全新本地执行 provider。 |
| `maxActiveRuns`、`maxActiveRunsPerOwner`、`dispatchIntervalMs` | 宿主或 owner 容量与无模型就绪轮询。 |
| `healthEnabled`、`healthIntervalMs` | 定期诊断；`/antfarm health` 和 ensure-execution 也支持手动调用。 |
| `gitTimeoutMs`、`subprocessGraceMs` | 原生前端 diff 时限与子进程终止宽限。 |
| `webhookTimeoutMs`、`webhookTokenEnv` | 尽力投递的请求时限与可选环境凭据名称。 |

工作流 `notifications.url` 或显式 Run 订阅接收原版事件字段。URL 不含凭据、查询串或片段；认证使用原生环境引用。投递失败不改变 SQL 进度，宿主关闭会排空请求。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现与开发 — 点击展开</summary>

[加载器](src/workflow/loader.ts)保留原版工作流文档和人设资源。[数据库](src/persistence/database.ts)管理原版 `runs`、`steps`、`stories` 状态转换。附加 `dsh_*` 表记录 owner／Session 关联与原生调度排他性。`events.jsonl` 用于观察，不重建权威业务状态。

[Agent 适配器](src/runtime/agents.ts)在原生激活前将保留的 child ID 关联到稳定人设。它共用 `standard` 能力组合，同时在可见工具与实际派发中执行角色策略。DSH 管理模型循环、原生会话记录、父级权限与释放。[DESIGN](DESIGN.zh.md)解释恢复与归属；[PARITY](PARITY.zh.md)定义对照和验证范围。

</details>

-----

<a id="further-exploration"></a>
## 继续探索

- [原版工作流 fixture](tests/fixtures/original-antfarm/SOURCE.txt)
- [组合包装配](cordis.patch.yml)
- [仓库集成](https://github.com/winterhuan/dsh-creative/blob/develop/docs/subsystems/antfarm.zh.md)

-----

<a id="model-experience"></a>
## 模型体验

### 工作流工具与子会话指令

#### 模型看到什么

根模型收到五个工作流控制工具。每个子会话收到所选原版人设文件、声明的 skill 指令、项目路径、已解析步骤输入与原版既有上下文，并返回所要求的 `KEY: value` 文本。子会话不能启动嵌套 Antfarm 团队。Run UI 查询不进入模型上下文。

#### Token 影响

每次全新尝试重复完整身份、人设与职责指令。既有输出、故事验收条件、进度与验证反馈增加任务特定输入。工具结果可能包含原版上下文和故事概要；较长原生会话记录单独查看。

#### KV Cache 影响

身份段位于共用的原生提示词之后。人设变量从当前领取上下文解析，身份段会随变量和本地学习记录变化。全新 Session 不复用既有对话历史；provider 缓存复用取决于请求前缀是否匹配。

## 已知限制与待办

<a id="known-limitations-and-deferred-work"></a>

- 每个 Run 串行执行。每个稳定 agent 身份允许一个活跃尝试；多个运行共享 agent 时会等待。
- 角色策略限制直接工具。Shell 与 skill 仍可能修改文件；部署权限保持权威。
- 原版文本输出与 PR 链接是 worker 报告。宿主不独立批准 GitHub review，也不附加候选绑定的测试证据。
- 显式恢复后，中断的效果可能重复。SQLite、全新 Session 与事件日志不保证外部操作恰好执行一次。
- OpenClaw cron 安装、独立 dashboard 进程与轮询模型调用使用原生 DSH 等效机制。默认 Headless 缺少所需 preset 装配；DSH `0.2.2-rc.1` 没有 TUI 入口。
- [PARITY](PARITY.zh.md#acceptance-scope)区分本地机制证据、真实模型质量、平台与远程发布验证。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景 — 点击展开</summary>

Git 发布包包含预构建 Host／Web 入口和原版 persona 资源。[PARITY](PARITY.zh.md#acceptance-scope)记录验证范围。

</details>
