---
description: "原版 Antfarm 能力映射与本地验收证据范围。"
---

# 原版 Antfarm 功能覆盖

[English](PARITY.md) | 中文

## 摘要

对照基线为 snarktank/antfarm 0.5.1 的 `a442ad7dcb8cf8746175cc4a2e2dcafd501156cf`，来源保存在[原版测试资料](tests/fixtures/original-antfarm/SOURCE.txt)。DSH 替代 OpenClaw 专属调度和安装。本地测试验证执行规则，不证明真实模型质量、GitHub 交付或远程安装。

## 能力映射

| 原版能力 | DSH 实现与证据 |
|---|---|
| 全部或单个工作流安装/卸载 | 原生插件安装与项目启用状态；活跃依赖拒绝卸载，或在强制操作下取消并等待退出。[管理测试](tests/workflow-management.spec.ts) |
| 更新、帮助、版本与 ant | 原生 DSH 包更新；命令提供帮助、格式/版本身份和团队说明。固定 Git 包的安装、更新和回滚经过独立 profile 验证。[命令](src/commands/index.ts) |
| 发现与自定义 YAML/Markdown | 项目/用户/包来源优先级、修订约束副本和路径受限原版导入。[加载与导入测试](tests/workflow-management.spec.ts) |
| 运行/列表/状态/搜索/stories | 稳定编号、任务/id 前缀查询、歧义拒绝、分页列表与已接受 story 详情。[存储测试](tests/storage.spec.ts) |
| Peek/claim/complete/fail 执行者协议 | Host 就绪/容量、排他持久子会话尝试与原生结构化输出替代轮询执行者。结果不能推进其他尝试或绕过检查点校验。[日志测试](tests/journal.spec.ts) |
| 有序步骤、story 循环、逐项验证与重试 | 全新角色尝试、独立验证、有界向前修复、已接受上下文和累计重试授予。[执行器测试](tests/orchestrator.spec.ts) |
| 角色/人设/共享文件/模型/超时/skills | 六种 presets；原版 AGENTS/SOUL/IDENTITY 合为受路径约束的角色指令。缺少必需 skills 时拒绝准入。[原版导入](src/workflow/original.ts) |
| 功能开发、缺陷修复与安全整改 | 原生官方模板保留不同角色顺序、PR 交付与功能审查。[工作流测试](tests/workflow.spec.ts) |
| 自定义研究和写作 | 所属文件工作区、不可变显式输入、来源交接、独立检查与输出保留。原生文件产出/检查/下载/清理已有本地 DSH 证据。[文件测试](tests/files.spec.ts) |
| Cron 自主推进/ensure-crons | 不调用模型的 Host 队列/容量与启动 owner 恢复；ensure-execution 使用同一执行器。[容量](tests/capacity.spec.ts)与[owner 测试](tests/owner.spec.ts) |
| 停止/取消/恢复失败运行 | 原始 owner 权限、等待资源退出、保留已接受检查点与显式重试授予。[运行时测试](tests/runtime.spec.ts) |
| 经过测试的 PR 与 GitHub 审查 | 候选约束远程查询、写入权限和独立批准审查身份。原生角色工具执行声明效果。真实功能任务已创建 PR，由 `continuous1024` 在当前 HEAD 正式批准。[交付测试](tests/delivery.spec.ts) |
| 前端检测、浏览器检查与截图 | 前端路径变化触发必需成功原生浏览器证据与保留截图，缺少能力即阻塞。真实模型功能任务通过浏览器点击序列，截图保留并经过视觉检查。[视觉测试](tests/delivery.spec.ts) |
| 全局/单 Run 日志与事件 | owner 范围近期日志、单 Run 事件分页与原生会话记录；旧拒绝尝试可检查。[命令](src/commands/index.ts) |
| Dashboard/阶段/详情/输出/stories/刷新 | 原生全局工作流看板与会话侧栏，不增加独立 dashboard 守护进程。可见视图发现新工作、支持操作并保留读取失败前的内容。[Client 测试](tests/runs.client.spec.tsx) |
| Medic 安装/卸载/运行/状态/日志 | 原生运行时健康设置、定时/手动检查、历史、超期/不活动/不确定诊断与安全不活动工作的 ensure-execution。超时不能批准结果。[健康实现](src/runtime/index.ts) |
| 升级/owner 通知 | 原生 owner 收件箱持久通知与 Session 刷盘确认。成功本地 DSH 投递已有记录。[通知测试](tests/notifications.spec.ts) |
| 工作流/Run Webhook 与认证 | 显式订阅、环境凭据引用、稳定事件 id、有界等待与持久不确定状态。真实外部服务验证认证、成功、拒绝、超时、不确定投递与事件去重。[通知测试](tests/notifications.spec.ts) |

## 实质区别

DSH 以 Host 调度替代轮询模型调用，以权威日志检查点和可重建 SQLite 索引替代 SQLite 业务行，以原生面板替代独立 dashboard。原生结构化输出在验收前校验声明输出要求。每项必需最终检查对应候选，修复不能保留过期通过检查。文件工作流使用显式输入快照与输出摘要保留。Worktree 保留分支并拒绝清理脏目录。原版按时间重置遗弃尝试（第五次遗弃即失败），这里改为等待原生超时退出；崩溃未结算尝试要求 owner 核对，不按时间自动重跑。

管理 OpenClaw cron 执行者或 dashboard 进程的原版命令提供原生等效入口，不保持相同拼写。仅供轮询的模型/cron 字段保留为导入元数据，不触发模型轮询。原版导入保留声明输出要求，但不自动推导原生 `requireChecks`、视觉或交付强制校验：使用包内原生模板，或为导入副本明确添加这些字段。

<a id="acceptance-scope"></a>
## 验收范围

`0.2.0` 的 macOS 与 Linux 检查覆盖 Host/Client 类型、构建、打包和 16 个测试文件的 124 项测试。DSH `0.2.2-rc.1` 的原生 Web 验证工作流编辑、运行控件、看板导航、成果下载和清理后读取；Headless 验证默认等待最终业务状态与冷恢复。固定 Git 安装包在隔离 profile 中验证安装、更新、回滚、移除与重新安装。

真实 `deepseek-flash` 功能任务从规划、实现、独立验证、测试到 PR 与审查完成。计数器 fixture 的 7 项测试与浏览器 `0 → 2 → Reset 0 → Increment 1 → Reset 0` 通过；Host 核验同一候选的实际命令、截图、PR HEAD 和 `continuous1024` 的正式批准。真实研究任务通过独立文件角色、输入快照、报告保留和 Headless 冷恢复完成。有界重试与人工核对保留在运行记录中，首次阻塞或 CLI 退出码 0 均不算业务完成。

原生生命周期验收确认 owner 卸载不丢弃安全排队工作；重启无需 parent 模型轮次即可恢复，未结算尝试保持中断，明确核对后才继续。主动取消等待 teardown 并记录取消。外部 webhook 服务实际接收认证请求；拒绝与超时保留失败／不确定结果，确认投递的相同事件不重复发送，通知失败不改变业务状态。

原版三套工作流的结构和导入均有测试；完整真实模型交付验收使用 `feature-dev`，研究任务验证文件工作流。它们不证明所有任务或模型的质量与成本。`deepseek-flash` 不支持图像输入，因此模型的 DOM 检查由额外截图视觉检查补充。DSH 当前没有 TUI 应用入口，支持并验收的是 Web 与配置完整的 Headless，TUI 不记为通过。
