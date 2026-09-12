# 第三方许可与修改说明

`overlay/payload/openclaw/`、`overlay/payload/acpx/` 及相应 tests/fixtures 包含 OpenClaw 仓库衍生文件，基线 2026.9.4。保留 MIT 许可见 `licenses/openclaw-MIT.txt`。ACPX 的 npm 包未单独带 license 字段，此处按同一上游仓库保留其 MIT 文本，公开分发前 review 须核对源文件适用范围。

`overlay/payload/claude-agent-acp/` 与 adapter fixture 包含 claude-agent-acp 0.70.0 衍生文件，Apache-2.0 许可见 `licenses/claude-agent-acp-Apache-2.0.txt`。payload 中 acp-agent.js 已本地修改；fixtures 为接受的修改前版本。新增 openclaw-acp-compat-v1.mjs 为本地辅助模块。没有打包 Claude Code 或 Anthropic SDK 的实现。

各 payload 修改的用途与范围在 README、UPSTREAM 及 manifest 中列明；请通过 fixture→payload diff 区分上游与本地改动。其余本地脚本、skill、helper 与文档尚未由所有者指定公开许可证，不能以本文件替所有者授权。当前仅准备 private review，不把上游许可误套成全包自有代码许可。

可选 SDK/zod 依赖未复制到包内，安装时须保留各自分发的许可证。本包未包含任何用户对话或记忆作为测试 fixture。
