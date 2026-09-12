# GitHub 贡献盘点

2026-09-13，通过当前登录 GitHub 账号的作者检索及具体 PR/issue 页面核对。范围是当前账号，不能排除其他账号的历史贡献。

## 已有成果

| 记录 | 当前状态与意义 |
|---|---|
| [acpx #468](https://github.com/openclaw/acpx/pull/468) | 自己提交的 `feat(runtime): expose permission policies to embedders`，2026-08-13 merged。向嵌入方开放已有 permission policy，并贯穿创建/恢复/控制等路径。无需重新贡献同一接口。 |
| [acpx #467](https://github.com/openclaw/acpx/issues/467) | 对应 permission policy 提案，已关闭，由 #468 落地。 |
| [OpenClaw #112052](https://github.com/openclaw/openclaw/issues/112052) | Claude CLI 可见 reasoning 丢失的 bug 报告，已关闭为 completed；维护者明确确认比较 final 与 draft 路径的证据帮助定位。 |
| [OpenClaw #117264](https://github.com/openclaw/openclaw/pull/117264) | 上述报告促成的 parser 修复，2026-08-01 merged；代码作者为其他贡献者，不把它算成自己的代码 PR。 |
| [OpenClaw #113388](https://github.com/openclaw/openclaw/issues/113388) | Host-owned restrictive policy 提案，目前 open。ACPX permission 接口已落地，不意味着宿主全部策略要求都已实现。 |

## 这轮值得贡献什么

| 优先级 | 候选 | 建议 |
|---|---|---|
| 1 | ACP reply_dispatch 超时/异常后落入普通 CLI，可能让已经启动副作用的同一任务又被其他 runtime 执行 | 最值得先做一个窄 PR。9.4 已有真实 dispatcher 的 11 类离线回归与超时后 fallback 基线证据。先在最新 main 复现并去重，保留 ACP ownership、原生命令、abort/private delivery 语义。3600 秒预算属于本地策略，不顺带修改上游默认。 |
| 2 | ACPX 独立 npm 安装布局下找错 OpenClaw MCP bridge 根路径 | 通用安装兼容问题；适合单独小 PR，补 bundled 与 external npm 布局测试。当前关键词搜索没有命中完全对应 PR，但这不是不存在重复项的证明。 |
| 备选 | ACP `/new` 后丢失原绑定目标或落入 main | 9.4 有复现、修复及 Telegram 验收。生命周期领域已有多项上游改动，先检查最新 main 的问题是否仍在；若已修则只删除本地对应补丁。 |
| 合作已有 PR | `CLAUDE_CONFIG_DIR` 下 transcript 位置解析 | 已有 open [#145650](https://github.com/openclaw/openclaw/pull/145650) 与 [#145895](https://github.com/openclaw/openclaw/pull/145895)。提供复现/测试/review 更合适，不再发第三个重复 PR。 |
| 留本仓维护 | 中文 reasoning 翻译、摘要与保留样式 | 个人体验选择。可以独立插件/扩展分享，暂不要求上游接受整套呈现规则。 |
| 留本仓维护 | 最近 Telegram known-ID edit failure 被当作 unknown send 的兼容修复 | 此处 `acpPhysicalAmbiguous` 属于自有 overlay。不能直接把自有补丁 bug 作为上游 stock bug 提交；只有在原版另行复现后才谈上游修复。 |
| 留本仓或另发 skill | `[ACP]` 开通、topic mute、独立 memory helper | 先做通用配置/skill 分享；私人群名单、模型顺序、BNB 业务策略不适合核心代码 PR。当前 helper 的宿主参数可移植化也不需要新增 memory 平台。 |

与第一项相关但不能当成同一修复的记录：[关闭未合并的 #97649](https://github.com/openclaw/openclaw/pull/97649) 处理 unclaimed ACP 首轮问题；[已合并 #139052](https://github.com/openclaw/openclaw/pull/139052) 重构 reply hook 调用。必须在最新 main 上区分“尚未启动时安全重路由”与“已开始执行后超时，重复执行风险”，不能照搬旧 PR。

## 贡献方式

前提：我们希望减少每次升级维护量。证据：permission policy 已被合并，reasoning bug 报告也促成上游修复，同时 transcript 已有重复开发。推断：每次只提交一个已在最新 main 复现的通用缺陷，最有机会缩减本地补丁。置信度：高；上面候选目前仍是 9.4 证据，不宣称已验证最新 main。

正式开工时建议 GPT‑5.6 high 或 Fable 5.1 high。先读上游当前 CONTRIBUTING.md/AGENTS.md，提交 TypeScript 源码最小修改与对应测试，不上传本包编译产物、private 配置或整套 overlay。遵守当时的 AI 使用披露及测试要求。一次只推进候选 1；候选 2 可以留待下一次。

评审补充：候选 2 的本地改法依赖 ACPX 可解析的 OpenClaw peer；缺失时抛错，错连时可能桥接其他安装。上游提案须覆盖无 peer 的外部 npm 布局，评估原启发式回退或明确报错，不能直接照搬本地一行修改。本次未重新联网核对 PR 状态。
