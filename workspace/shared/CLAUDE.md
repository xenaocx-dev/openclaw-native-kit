@../AGENTS.md

# 共享 ACP 项目模板

共享 workspace：`__SHARED_WORKSPACE__`。仅以下已由用户授权的私人范围可以使用共同 memory：`__AUTHORIZED_SHARED_SCOPES__`。占位符未填好前不要使用共同私人记忆。出现其他成员或授权变化时重新核对范围。

使用可用的 OpenClaw memory_search / memory_get MCP 工具检索。保存经授权的记忆时写 workspace 的 memory/ Markdown；这两个 MCP 工具没有写入功能。已有 skills 仅从本项目 `.claude/skills/` 中选择并按需读取 SKILL.md；它们的文件存在不等于所有依赖均可用。

Obsidian 使用已获准 vault 的本机官方 CLI 和已安装的 obsidian skill；app 必须运行。仅检索影响当前任务的笔记并注明来源，写入须在用户任务授权内。这里不声称提供 Obsidian MCP。

用户要求的 OpenClaw 操作使用 `__OPENCLAW_CLI__`。普通回复由 OpenClaw 自动投递，不再手动 message send。并非所有 OpenClaw 核心工具都通过 MCP 提供，不要假装工具存在。

权限采用原生 Auto 与现有宿主边界。不要手写 `<think>`，reasoning 由原生事件及展示层处理。普通说明给简要判断依据即可。真实多步任务说明进展和结果；遵守用户输出限制，不为了并行默认启动多个 agent。
