# r2 增量评审回执

日期：2026-09-18。Fable 5.1 / thinking high 评审候选 `b6cba3e`，基线 `c3101af`。本文件归档结论和处置，不替代原始本地 `REVIEW_RESULT.md`。

结论：可以更新已有 private 仓库，无上传阻塞项。不是公开发布、空白 Mac 重建或完整生产 E2E 认证。

| 发现 | 本轮处置 |
|---|---|
| P1 接管通知抛错可能遗留运行中的原生 turn，并留下重复执行窗口 | 静态核对异常传播路径；在 release-r2 与 README 显式记录，列入后续 r3。修复须验证取消、去重和重投递，未直接采纳吞异常方案。payload 不变。 |
| P2 接管会改变 dispatcher 去重提交语义，文档未说明 | release-r2、verification 已补说明，并注明回调抛错例外。 |
| P3 config-contract 两处仍写 17 项 | 改为 20；r1 历史回执保留原数值。 |
| P4 上游候选遗漏本次问题 | UPSTREAM 新增本地 issue/测试线索，与 CLI 重路由问题分开，明确远程状态仍是旧快照。未联网或对外提交。 |
| P5 journal 没有 revision | 保留现有安装器，按时间、hash、Git commit 识别；本轮不增加字段。 |
| P6 worktree 的 .git 指针不应进入分发压缩包 | Git push 不跟踪该文件。若以后打包，用 Git 跟踪文件生成归档，例如 git archive；不对整个 worktree 直接 tar。 |

评审实际执行：74 文件清单与 20 payload 校验、默认 npm test、46 个 JavaScript 文件语法检查、6 个变更 diff、3 个 r1 fixture 对历史提交的字节比对、秘密/路径扫描、Git 忽略检查，均通过。

未重跑可选 ingress 测试和 helper MCP 测试；未访问生产、联网核对上游或执行真实 Telegram E2E。上述历史证据与本次评审应分别理解。后续文档收尾增加本回执后，清单文件数为 75；代码及测试内容不变。
