---
description: "原版 Antfarm 行为对照与发布验证范围。"
---

# 原版 Antfarm 覆盖范围

[English](PARITY.md) | 中文

## 概述

对照基线为 snarktank/antfarm `0.5.1`，记录在[原版 fixture](tests/fixtures/original-antfarm/SOURCE.txt)中。包内三套原版 YAML 工作流和人设资源保持不变。DSH 提供原生执行、归属与界面；SQLite 保留原版业务方法。此页区分机制检查、发布安装和真实模型质量证据。

## 能力映射

| 原版能力 | 原生实现与验证归属 |
|---|---|
| 工作流与人设资源 | 完整原版 YAML、AGENTS／SOUL／IDENTITY 文件；[资源测试](tests/workflow.spec.ts)。 |
| Agent 身份、角色与模型 | 稳定的工作流限定身份、条件人设、共用 standard 装配、工具派发策略；[运行时测试](tests/runtime.spec.ts)。 |
| SQLite 持久化 | 原版业务列与原子状态转换；[数据库测试](tests/database.spec.ts)。 |
| Peek／claim／complete／fail | 无模型就绪检查、确切原生领取者、原版文本结果与失败预算；[数据库](src/persistence/database.ts)。 |
| Story 循环与逐项验证 | 原版 STORIES_JSON、全新尝试、故事重试与恢复计数保留；[数据库测试](tests/database.spec.ts)。 |
| 时限与放弃 | 原生子会话时限／释放计入独立的单步放弃和逐故事重试。 |
| Agent 工作区、skill 与进度 | 稳定目录、受管理人设更新、可选原生 skill 查找、原版进度归档；[适配器](src/runtime/agents.ts)。 |
| 安装／卸载／导入 | 原生组合包安装与绑定修订的项目／用户覆盖；[管理测试](tests/workflow-management.spec.ts)。 |
| Run／list／status／stories／logs | 原版 SQL 摘要、Session 归属、编号／前缀／任务查找、原生会话记录。 |
| 停止／恢复 | 确切子会话取消、中断 owner 恢复与迟到结果拒绝；[运行时测试](tests/runtime.spec.ts)。 |
| 前端检测 | 通过原生 Git 子进程执行原版生产文件检测；[进度适配器](src/runtime/progress.ts)。 |
| 事件／webhook | 原版事件字段、尽力认证 HTTP、请求排空；[webhook 测试](tests/notifications.spec.ts)。 |
| Dashboard 与 medic | 原生侧栏／授权看板、定期诊断和安全 ensure-execution；[客户端测试](tests/runs.client.spec.tsx)。 |
| 历史 DSH 运行 | 完整前缀、owner 授权的只读查看，不改变字节；[历史测试](tests/legacy.spec.ts)。 |

## 实质差异

DSH Jobs 与无模型宿主轮询替代 OpenClaw cron／轮询模型；DSH 面板替代独立 dashboard 守护进程。Agent 共用原生能力装配，同时保留各自人设。原生 owner／attempt／host 关联是附加 SQL 表，原版业务行保持权威。

DSH 要求在重放崩溃时开放的尝试前完成核对，不根据计时器过期推断安全。确切领取者身份拒绝过期结果。被引用的逐项验证步骤可在循环等待验证时执行，验证耗尽会暴露可恢复的失败步骤；这些处理避免原版前序／恢复停滞。确认释放后，角色时限保留原版重试／放弃预算。

原版人设仍引用 OpenClaw worker 完成命令。原生任务输入要求 agent 返回原版最终文本，由宿主记录完成。可选 skill 通过 DSH provider 解析。Webhook 凭据使用原生环境引用，而非 URL 片段。单步失败指令保留为元数据；原版 worker 完成路径不将其执行为通用重试图。

Worker 的成功回复是其报告结果。适配器不附加独立候选绑定检查、GitHub review 批准、不可变成果快照、研究／写作模板、追加重试授权或逐 Run worktree 清理。自定义原版格式工作流仍受支持。

<a id="acceptance-scope"></a>
## 验收范围

隔离 Web 验收完成 feature-dev（7 次尝试）、bug-fix（6 次尝试）和 security-audit（7 次尝试）。SQLite 确认三个运行已完成，20 个尝试具有不同的原生 Session 标识，每个都执行了真实 Bash。看板、阶段输出与子会话导航经过浏览器检查；模型结果和 PR 地址均为确定性测试数据。另一个保存后的项目覆盖在重启后完成，写入并归档原生进度，检测真实前端 Git 变更，且子会话工具中不包含原生 gateway／cron 对应能力。

实现检查覆盖 macOS Host／Client 类型、清理构建、包装配、原版 SQL／身份／生命周期行为、客户端查询、历史保护与 webhook 释放。原生 Web 验收使用隔离 DSH `0.2.2-rc.1` profile 和确定性模型适配器；原版步骤结果与原生子会话／工具执行分别核对，不依赖 CLI 退出码。

这些确定性检查不证明真实模型实用性、在线 GitHub 交付或 Linux／Windows 行为。远程发布安装需要单独的包／配置与浏览器证据。既有 `0.2.0` 发布证据描述该版本不同的运行时，不能验证本实现。固定 DSH 版本没有 TUI 入口；默认 Headless 缺少所需 preset 装配。

## 开发备注

其他平台与代表性真实模型任务需要各自的验收记录。
