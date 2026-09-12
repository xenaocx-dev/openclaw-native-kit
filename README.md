# OpenClaw native kit — 上传前评审包

2026-09-13。目标是保存当前可复用配置与版本绑定补丁，供 Claude Code Fable 5.1 review。此目录尚未上传，建议首次使用 private GitHub repository。

## 内容与边界

- `overlay/`：原有 17 个补丁目标，11 个修改后的上游文件和 6 个辅助文件；payload 与迁移维护版本逐字一致。
- `config/`：从当前部署抽取的配置片段，保留普通模型 Fable 5.1 → Astra → Opus 5 → GPT‑5.6 Sol、ACP Fable 5.1、高 thinking、本地 memory 等意图。所有安装路径及群/topic 均用占位符。
- `workspace/`：共享及独立 memory 的 Claude 项目模板；Auto 审批、skills 和 Obsidian 接入说明。
- `skills/acp-topic-setup/`：现有 `[ACP]` 开通指引的通用化副本。
- `plugins/telegram-topic-mute/`：现有静默插件，代码未改；规则在独立示例中，未包含真实静默目标。
- `helpers/topic-memory-mcp.cjs`：现有 BNB memory helper 的可移植副本，只调整依赖导入、workspace/source 环境变量及展示名称；原生产文件未改。
- `REVIEW.md`：可直接交给 Fable 5.1 的评审任务。
- `UPSTREAM.md`：既有 GitHub 贡献、重复项及候选优先级。

不包含账号凭据、token、原配置、Telegram 标识、会话数据库、对话、memory 正文、Obsidian 笔记、业务 workspace、19 个私人 skills、安装依赖树及历史备份。认证需要在目标机器重新完成。个人定时任务、其他模型目录、旧 wrapper 和历史实验不属于这份可复用基线。

这是一份可评审的配置与补丁包，尚未完成空白 Mac 重建验收。JSON 是合并片段，不能直接覆盖完整生产配置；身份认证、频道接入、服务注册、浏览器及宿主权限仍由目标机器的官方初始化流程配置。没有新增自动部署或自动升级系统。

## 本地检查

需要 Node 24。以下检查离线运行，不安装依赖、不调用模型、不连接 Telegram、不接触生产实例：

```sh
node scripts/check-package.mjs
node overlay/tests/overlay.test.mjs
node --test overlay/tests/presentation.test.mjs
```

第一项核对交付清单、文件 hash、JSON、符号链接、禁止的运行状态文件和常见凭据格式。它不能代替人工脱敏 review。第二项用包内 11 个获准的源文件构造临时安装，验证 apply、备份、幂等、版本与未知改动拒绝。第三项复用中文展示的合成测试，验证编辑/附件完成后才清理旧页及失败时保留内容。完整运行时和真实 Telegram E2E 不在这三条检查的证明范围内。

已具备下面列出的可选 MCP 依赖时，还可运行 `node helpers/topic-memory.test.cjs`；它启动真实 stdio MCP，但只读写临时合成 workspace，测试工具发现、保存、去重、检索、读取及越界拒绝。默认三项检查不要求这些依赖。

## 固定依赖

| 组件 | 本包基线 |
|---|---|
| Node | 24 |
| OpenClaw / 官方 `@openclaw/acpx` | 2026.9.4 / 2026.9.4 |
| `@agentclientprotocol/claude-agent-acp` | 0.70.0 |
| Claude Code | 可由上述 adapter 启动的本机原生 CLI；需重新原生登录 |
| 本地 embedding | Ollama `bge-m3`，`127.0.0.1:11434/v1` |
| 中文展示整理 | Ollama `qwen3:4b-instruct-2507-q4_K_M`，loopback 11434 |
| 可选独立 memory helper | MCP SDK 1.29.0、zod 4.4.3 |

不要通过修改 manifest 版本号把补丁硬套到新版本。ACPX 必须通过官方 npm 安装流程取得可信来源记录，直接拷贝插件目录不等同于可信安装。translator 可通过 `OPENCLAW_REASONING_OLLAMA_BIN` 指定本机 Ollama；模型及运行组件不在包内。

## review 后的部署顺序

1. 在隔离目标完成官方 9.4 初始化及原生登录。安装精确版本，读取 `overlay/README.md`，先 verify，再停稳该目标并 apply。不要操作现有生产 Gateway。
2. 先按 `docs/config-contract.md` 核对 Gateway、adapter、state 及 ACPX peer 指向同一套安装，再替换配置中的 `__STATE_DIR__`、`__NODE24__`、`__CLAUDE_EXECUTABLE__`、`__CLAUDE_ADAPTER_BIN__`、`__KIT_DIR__`、workspace、群及 topic 占位符。所有路径用目标机器绝对路径。model ID 还须在该账号/提供方可用。
3. 将示例逐项合并进官方初始化的配置；同一对象按字段合并，`bindings` 按 peer 去重。只选择需要的共享/独立模板，不能整体替换已有 agents、bindings 或 plugin entries。
4. shared 的 `CLAUDE.md` 放入共享 workspace 的 `acp-topics/`；isolated 放入独立 workspace。`settings.local.example.json` 改名为 `.claude/settings.local.json`；独立 MCP 示例改名为 workspace 根目录 `.mcp.json`。
5. 可选 memory helper 在本包目录安装所列精确依赖后可运行。安装可能联网；本次未自动执行。它是原有 Markdown search/get/propose 服务，不是新增 memory 后端。OpenClaw 的 memory_search/get 仍按 owner workspace 索引，独立 owner 不设置指向共享 workspace 的 extraPaths。
6. 只链接用户选定且允许该 scope 使用的 skills 到 `.claude/skills/`。Obsidian 需要目标机已有官方 CLI、正在运行的 app、获准 vault 和对应 skill；它不属于新增 Obsidian MCP。
7. 使用目标版本的官方 `config validate` 检查完整候选配置。不要把示例占位符校验通过误认为安装成功。之后再按 `docs/verification.md` 做范围明确的运行验证。

普通路径的 fallback 不等于 ACP 会话自动跨 harness/account fallback。当前 ACP 示例选择 Fable 5.1；Astra 普通路径使用 Codex runtime。**本包没有验证 Astra ACP 的中文 reasoning 或权限行为。** 不因共用模型目录而作此承诺。

共享 memory 只用于事先授权的私人范围。独立 workspace/索引实现数据组织上的分开；原生 Auto 与宿主文件权限不构成跨 topic 的安全沙箱，模型获得工具权限时仍可能访问其他文件。真正的强隔离需单独的系统边界，不在本包新增实现。

## 发布与维护

首次 review 建议 **Fable 5.1 high**，打包整理及常规后续使用 **GPT‑5.6 medium**。优先修阻碍上传或复现的问题；不要为了本包新增框架、CI 矩阵、后台服务或全量重建器。

本包已完成首次 Fable 5.1 review；修订回执见 `docs/review-fixes.md`。先完成 review，再决定 private 上传。公开发布前还需明确自有代码许可证；第三方文件保留原许可证，见 `THIRD_PARTY_NOTICES.md`。不得将本地认证/状态备份提交到此目录。现有包没有自动回滚命令；apply 会生成备份和 journal，恢复前须停稳对应目标并据 journal 恢复，不能恢复整台机器的旧状态。
