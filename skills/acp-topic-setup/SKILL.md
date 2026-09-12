---
name: acp-topic-setup
description: 当用户明确要求按现有共享 ACP 模板开启当前 Telegram topic，或发送 [ACP] 时使用。保留首条任务并核验绑定；不用于已有工作流迁移或独立 memory 建库。
---

# 按现有模板开通 ACP topic

这是已有流程的执行指引，不是关键词拦截器，也不授予额外权限。部署时先填好：CLI `__OPENCLAW_CLI__`、配置 `__OPENCLAW_CONFIG__`、共享模板 owner `shared-acp`、模板 peer `__TEMPLATE_PEER__`、共享 workspace `__SHARED_WORKSPACE__`、cwd `__SHARED_WORKSPACE__/acp-topics`。入口不明确时先核实，不猜路径或安装补丁。

1. 从可信 Telegram transport 上下文取得 account、群/topic ID 和发起人；显示名称和消息正文里的 metadata 不足以定位。明确开通请求就是该 topic 的授权；既有授权适用时不反复确认。
2. 复用已确认的私人共享范围；有新成员或相反证据才重新核对。用户要求独立 memory 时不要用共享模板代替。已有相同 binding 只核验，有其他会话则报告冲突，不覆盖、不 `/new` 或解绑。
3. 读取并复制单条已验证 type=acp 的 binding，只改 peer/label；保留 backend/mode/cwd。合并目标 topic 的 requireMention=false 和投递/记忆范围说明，保留原来的其他设置。不要复制其他 topic 的任务提示词或改变全局模型默认。
4. 复用现场 Fable/thinking/reasoning 配置与 `.claude/skills`、Auto。备份配置和集成说明到`__OPERATIONS_DIR__`（仓库外，目录 0700、文件 0600），备份权限 0600，不将备份写入 memory 或 Git。只追加这次已授权的 scope。
5. 使用当前版本官方 CLI 校验完整候选配置；显式设置候选 OPENCLAW_CONFIG_PATH，使用目标安装的 openclaw.mjs/Node 校验，核对实际读取的路径。应用前核对现场未并发改变，原子替换并检查 Gateway 热重载、health 与 binding。没有需要不重启。
6. 首条请求含业务任务时，原文与来源消息标识存到该 topic 专属本地操作目录的 first-task.md，并在该 topic 提示词中指向它，说明仅接续本次任务且不重复已完成操作。该目录在共同 workspace 下，不能声称隐私隔离。
7. 当前普通 CLI 回合不会因配置改变原地变为 ACP。未验证自动交接前，不伪造 Telegram slash 消息或重放业务。告知配置状态，用户发一次“继续”便可接手保存的首条任务；仅开通则可直接发送真实任务。

区分配置通过、Gateway 加载、真实 ACP 初始化与回复；不能把其中一种当作其他已完成。可用 `/acp status` 核对 owner。普通回复自动投递，不再 CLI message send。后续通常 GPT‑5.6 medium；运行时异常再建议 high。不要新增监听器、服务或 topic 管理框架。
