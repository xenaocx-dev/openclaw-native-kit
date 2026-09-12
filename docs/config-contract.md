# 运行副本与配置契约

## 副本核对（P1/P2）

verify/apply 均输出 `roots` 四个解析后的绝对路径。它们只说明处理了哪份副本，不能自动证明运行中的 Gateway 正在使用该副本。

- `roots.openclaw` 必须是 Gateway 启动入口所属安装；同版本的另一份安装不算。
- `__CLAUDE_ADAPTER_BIN__` 解析符号链接后的入口必须位于 `roots.adapter` 内；只比较 npm `.bin` 路径字符串不够。
- `roots.state` 必须与 Gateway 的 `OPENCLAW_STATE_DIR` 一致（未覆盖时通常为 `~/.openclaw`）。apply 将 translator 写到该目录的 `bin/openclaw-acp-reasoning-cn.mjs`，权限 0700。
- ACPX 的 peer 解析必须指向同一 `roots.openclaw`。官方插件安装通常提供 peer 依赖关系；复制包或单独 npm 安装不保证这一布局。

填入根目录后，用 Node 24 运行以下只读核对。这与补丁的解析方式相同；找不到包或指向其他副本均失败。overlay 的 17 项 installed 本身不检查 peer 关系。

```sh
OC_ACPX_ROOT=/path/to/node_modules/@openclaw/acpx \
OC_OPENCLAW_ROOT=/path/to/node_modules/openclaw \
node --input-type=module <<'JS'
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const requireFromAcpx = createRequire(path.join(process.env.OC_ACPX_ROOT, 'dist/config-D2FTk0K7.js'));
const entry = requireFromAcpx.resolve('openclaw');
const peerRoot = fs.realpathSync(path.resolve(path.dirname(entry), '..'));
const expected = fs.realpathSync(process.env.OC_OPENCLAW_ROOT);
console.log(JSON.stringify({entry, peerRoot, expected}, null, 2));
assert.equal(peerRoot, expected, 'ACPX resolves a different OpenClaw copy');
JS
```

失败时用目标实例的官方插件安装/修复流程恢复依赖关系，然后重查。不要自动把链接连到 PATH 上碰巧找到的安装。本次补齐前提与核对命令，未修改 acpx payload，也未实现无 peer 布局的通用回退。

## 环境变量

| 变量 | 读取组件 / 默认 / 约束 |
|---|---|
| `OPENCLAW_ACP_NATIVE_PERMISSION_FORM` | 已打补丁的 adapter；未设置不启用；值为 `1` 且客户端支持 form 时走原生表单，否则保留 requestPermission。 |
| `OPENCLAW_ACP_REASONING_DISPLAY` | 已打补丁的 adapter；未设置保留 SDK 原行为；`summarized` 且 thinking 未禁用时设置原生 summarized display。 |
| `OPENCLAW_ACP_REASONING_LANGUAGE` | 已打补丁的 adapter；未设置不加语言指令；`zh-CN` 加入原生中文摘要提示，不保证模型一定输出中文。当前模板未启用。 |
| `OPENCLAW_REASONING_OLLAMA_BIN` | translator；默认 `/opt/homebrew/bin/ollama`，可改为目标机 Ollama 可执行文件。 |
| `OPENCLAW_REASONING_OLLAMA_ENDPOINT` | translator；默认 `http://127.0.0.1:11434`；只允许 HTTP loopback、显式 11434，无认证信息、路径、query 或 fragment。 |
| `OPENCLAW_REASONING_TRANSLATION_MODEL` | translator；固定 `qwen3:4b-instruct-2507-q4_K_M`。不设置或填相同名称均可；其他值会抛错，不能用它换模型。 |

前三项不是上游原版 adapter 的保证；若指向未打补丁副本可能被忽略。后三项须进入实际执行 translator 的 Gateway 进程环境。不要仅在一个交互 shell 中设置就认为服务已经继承。

## 占位符

| 占位符 | 含义 |
|---|---|
| `__STATE_DIR__` | 目标 Gateway state 绝对路径 |
| `__NODE24__` | Node 24 可执行文件 |
| `__CLAUDE_EXECUTABLE__` | 原生 Claude Code 可执行文件 |
| `__CLAUDE_ADAPTER_BIN__` | 与 overlay adapter root 一致的启动入口 |
| `__KIT_DIR__` | 此包的绝对路径 |
| `__SHARED_WORKSPACE__` / `__ISOLATED_WORKSPACE__` | 分别获准使用的 workspace |
| `__GROUP_ID__` | 可信 transport 确认的目标群 |
| `__SHARED_TOPIC_ID__` / `__ISOLATED_TOPIC_ID__` / `__TOPIC_ID__` / `__MUTED_TOPIC_ID__` | 对应操作的 topic；不能互换 |
| `__OPENCLAW_CLI__` / `__OPENCLAW_CONFIG__` | 目标安装 CLI 和完整配置文件 |
| `__TEMPLATE_PEER__` | 已验证的共享 ACP 模板 peer |
| `__AUTHORIZED_SHARED_SCOPES__` / `__ISOLATED_SCOPE__` | 用户实际授权的记忆范围 |
| `__OPERATIONS_DIR__` | 仓库外、本地受限的 topic 操作目录；存配置备份和首条任务，目录 0700、文件 0600，不纳入 Git 或 memory |

目标 workspace 须已有或由用户填写 AGENTS.md，才能使用 CLAUDE.md 的导入。不要复制其他 scope 的私人规则或记忆。

## 兼容约定

静默插件与预览层依赖 `telegram-topic-mute` / `telegram-topic-mute:route-only:v1` 的固定标识；改名可能令预览退回上游限制。ACP hook 未正常完成时会显示中文错误通知并阻止普通模型重做；这不等于普通模型的 fallback。

本次保留 memory helper 的 `bnb-memory:` 去重标记和 Singapore 日期格式，以免已有记忆去重及日文件分界改变；它们不是用户身份或秘密。该副本目前是可移植的原试点实现，未承诺通用时区。需要公开通用化时单独做兼容迁移。payload 中旧版本注释和未使用的辅助函数也留到下次源码重建，不为注释改动打破当前 17 项 hash 对照。
