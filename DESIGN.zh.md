---
description: "Antfarm 执行、候选验收、检查点恢复、资源生命周期与 DSH 职责。"
---

# Antfarm 实现

[English](DESIGN.md) | 中文

## 摘要

Antfarm 在所属 Git 或文件工作区运行专业工作流，跨 Host 重启保留已接受检查点。DSH 管理 presets、模型执行、子会话记录、jobs、权限和子进程。Antfarm 管理工作流配置、已准入工作、候选验收、重试、恢复与输出保留。本文面向 DSH `0.2.2-rc.1`；安装与用户操作见 [README.zh.md](README.zh.md)。

## 目录

- [执行与检查点](#execution)
- [恢复与所有权](#recovery)
- [工作区生命周期](#workspace)
- [Client 与打包](#client)
- [验证](#validation)
- [开发备注](#dev-note)

-----

<a id="execution"></a>
## 执行与检查点

[加载器](src/workflow/loader.ts) 在运行启动前解析 version 2 YAML 与 Markdown。它拒绝未知字段、无效引用、不支持的模板键，以及逃出配置根目录的指令路径。保存的运行包含解析后快照；恢复不重新加载被编辑的源文件。

每个 agent 指定部署提供的 preset、Markdown 指令，以及可选模型/超时覆盖。运行时要求 provider 支持全新本地 preset、结构化输出与 Agent options。每次尝试在启动前预留原生 child id，直接指定 run cwd，等待结果，校验结构化输出，并等待子会话释放。不使用空闲 coordinator 或独立模型引擎。

原生[执行证据](src/runtime/evidence.ts)记录前台 shell 命令、候选摘要、退出状态和有界输出。必需检查引用执行编号或完整命令，必须在所属 cwd 成功完成且不改变候选。源码编辑或修复使先前最终检查失效。交付查询将已打开 PR 与批准审查绑定到已提交 HEAD；拒绝自我批准。前端变化可要求实际浏览器命令证据及保留的 PNG/JPEG 截图。

[执行器](src/runtime/orchestrator.ts) 通过完整[检查点](src/persistence/types.ts)推进。规划检查点一次接受 stories、摘要与下一游标。单步骤检查点接受成功摘要与游标。失败保留为反馈，不会作为成功结果进入已接受 context。解析限制摘要、stories、id、验收条件与重试预算。

Story 循环通过全新子会话执行第一个非 done story。配置的独立验证子会话决定是否接受。失败消耗当前 story 的重试并保留反馈；已接受 story 保持 done。验证步骤由循环调用，不再作为顶层步骤重复执行。

顶层失败先消耗步骤重试，随后配置的更早修复目标接收带失败反馈的有界尝试。修复成功返回失败步骤。Loop 修复通过 `repairInput` 处理已接受 stories，不清除 done stories。预算耗尽时记录 blocked 检查点供人工恢复，或结算为 failed。

<a id="recovery"></a>
## 恢复与所有权

[运行时](src/runtime/index.ts) 在启动/恢复时校验活跃发起 Agent，将其 Session id 保存为 owner，在等待执行容量前保存准入。读取与控制要求该 Session id。每次运行仅允许一个本地操作和一个日志写入者；竞争者失败，不启动第二个执行器。[存储](src/persistence/storage.ts)以操作系统持有的 SQLite 锁限定同一根目录只有一个 Host，维护可重建查询索引。[容量](src/runtime/capacity.ts)限制实际尝试，保留 owner 排队顺序并轮换可执行 owner。

[日志](src/persistence/journal.ts) 保存有序且刷盘的 version 3 JSONL 记录。[Fold](src/persistence/fold.ts) 拒绝损坏记录，重建快照、检查点、尝试身份与工作区处置。原生 Session 日志由 DSH 管理。[原生 owner 恢复](src/runtime/owner.ts)无须模型回合恢复原始且未归档根会话的组合，启动时调度已保存安全工作。未结算尝试保持中断供核对。崩溃尾部恢复保留原字节与摘要。

子会话可能在业务检查点提交前已经结束。未配对尝试表示效果不确定，不能证明工作尚未发生。恢复要求查看记录与 worktree 后提供指导，再从最后一个已接受检查点使用全新子会话。外部效果可能重复；这是检查点恢复，不保证恰好执行一次。

恢复校验规范路径、仓库身份、预期分支与捕获基准提交的继承关系。继承基准的提交与人工工作区修改仍有效。已完成/取消或已清理运行不能恢复。失败运行需要显式重试预算授予并保留累计历史。可识别旧格式或损坏证据保持只读，不能静默迁移或重写。

取消先停止当前子会话并等待释放，再提交终态/处置记录与结算 job。插件释放时中止操作并等待完成。取消非活跃 blocked/interrupted 证据需要写入租约并保留输出。Blocked 运行结束后台 job，但仍可恢复。

<a id="workspace"></a>
## 工作区生命周期

[工作区模块](src/workspace/git.ts) 捕获非裸仓库根目录、公共 Git 目录与当前提交。它在项目内配置目录中，从该提交创建 `antfarm/<runId>`。基础检出修改与未跟踪/忽略文件不包含在内，也不复制环境文件。DSH subprocess 管理 Git 执行、取消、输出收集与退出。

创建时拒绝已跟踪的目标目录、已有目标、逃逸路径和含符号链接/变化的祖先路径。本地 Git exclude 隐藏配置的 worktree 目录，不修改已跟踪 `.gitignore`。身份校验要求预期分支与继承保存基准的 HEAD；子会话创建的提交仍是有效输出。

完成/取消运行的自动清理可配置。失败/阻塞运行保留输出。显式清理要求非活跃终态运行与写入租约。已跟踪修改、未跟踪文件、忽略文件、身份不符与 Git 错误都会保留工作区并记录原因。普通 worktree remove 不强制删除，始终保留分支。

[文件工作区](src/workspace/files.ts)支持 Git 外的研究与写作。准入时快照明确声明的 UTF-8 输入；每次 Run 拥有独立目录并记录输出摘要。已接受成果复制到私有 Run 存储，清理后仍可预览/下载。清理比较保留候选并拒绝变化或逃逸路径；原始输入留在所属目录之外。

Presets 限制直接提供的工具。Verification 保留 shell 执行检查，skill 执行可能有额外效果；移除写工具不等于文件系统隔离。部署权限、sandbox 与凭据继续适用。worktree 不隔离远程 API 或宿主账户。

<a id="client"></a>
## Client 与打包

[bundle 补丁](cordis.patch.yml) 从一个包激活运行时、工具、命令、有授权约束的 Studio Host、Client anchor 和六个 presets。[package.json](package.json) 固定 DSH `0.2.2-rc.1`。Host 构建生成 Typert 描述符/声明；Client 在注册读取组件前挂载 `dsh-antfarm/remote`。

[Studio Host](src/studio-host/index.ts) 将按 Session 寻址的 list/status 委托给运行时。[Client 挂载](src/client/mount.tsx) 注册一个原生右侧栏标签页，统一管理 Remote、字典、标签页与正文生命周期。它回滚部分挂载并打开原生子会话地址，还注册原生工作流看板、修订约束运行控件与[工作流编辑器](src/client/WorkflowPanel.tsx)。Profile 写入要求 Host 归属。未保存工作流草稿跨面板/会话导航保留，启动重试复用稳定准入 id。

[工作流管理器](src/workflow/manager.ts)依次解析项目、配置的用户目录和包内资源。编辑创建可写覆盖，不重写包内定义。规范路径检查、串行修订检查、唯一临时写入及不可变角色修订防止逃逸写入和过期保存。启用状态影响新准入；活跃 Run 保留其快照。删除覆盖恢复继承定义。

无模型健康检查记录有界诊断，不批准结果。[通知](src/runtime/notifications.ts)持久保存投递状态与稳定事件身份。原生 owner 投递等待 Session 刷盘；显式 webhook 使用环境凭据引用并保留不确定结果。健康恢复仅通过现有执行器调度安全工作。

[查询 hook](src/client/queries.ts) 在失败时保留已加载内容，中止过期的会话/选择请求并忽略迟到结果。它在读取完成后轮询可见视图，包括空列表和已完成列表，以发现新 Run。[RunsPanel](src/client/RunsPanel.tsx) 通过原生控件展示本地化信息。看板通过同一运行时索引读取明确授权的根会话。

<a id="validation"></a>
## 验证

[测试](tests/) 管理工作流校验、检查点、日志损坏、worktree、取消、恢复和 Client 读取/生命周期验证。边界替身提供确定的单元证据，不能证明模型执行或浏览器传输。当前结果应写入带日期验收记录；[基线覆盖](PARITY.zh.md)区分实现与外部验收。

类型检查、构建、测试与包检查见 [README 开发命令](README.zh.md#understand-the-implementation)。发布前验证隔离 DSH bundle/presets、原生子会话 cwd 和结构化输出、Runs/子会话跳转与目标平台。模型/网络访问和远程安装需要独立执行证据。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

运行时不提供隐式日志迁移、共享执行目录、自动环境复制或第二个模型调度器。原生 Workflow/Agent Team 保持独立，因为它们未提供此 Run 的持久游标和必需检查点 binding。

</details>
