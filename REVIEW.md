# 交给 Claude Code 的任务

建议模型：**Fable 5.1，thinking high**。请在这个目录做一次 r2 增量 review，以 `c3101af` 为 r1 基线。目标是判断此次候选能否更新到已有 private GitHub 仓库，以及有哪些必须先修的具体问题。

请先读 docs/release-r2.md、README.md、overlay/manifest.json 和 `git diff c3101af --stat`，运行 `node scripts/check-package.mjs` 与 `npm test`。重点看 6 个变更 payload 对照 r1/原版 fixture 的差异，以及下面各项是否受本次变化影响；其余 14 个 payload、helper 和配置模板不变，不要求重审全部旧代码。可选 ingress 测试已有记录，无需安装依赖或重新建环境。不要提交 Git、上传、发布 PR/issue、访问生产凭据、启动/重启 Gateway、重放业务或更改现有 topic/session。报告写入本目录 `REVIEW_RESULT.md` 即可；本轮先报告，不实施修复。无需多 agent。

重点检查：

1. 文件中是否残留 token、账号/群标识、个人绝对路径、业务内容、会话数据；不要在报告中复制秘密值。发现问题只给文件/行号/类别。
2. payload hash、精确版本、接受的源文件与备份/失败路径是否一致；未知版本或已改文件会不会仍被覆盖。配置/服务不应由 overlay 暗中变更。
   r1 → r2 是否只替换 6 个目标；authoritative promptStarted 才触发接管；真实 stall 的 Error 是否被已有 reasoning matcher 识别；测试结论是否超出证明范围。
3. 示例是否遗漏必要依赖或误述效果：普通 CLI 与 ACP 区分、fallback 范围、MCP 仅接入插件工具、独立 memory scope、Auto 并非安全沙箱、Astra ACP 未验收。
4. helper 的本次通用化是否只涉及安装与 scope 参数，是否保留原有路径/读写检查；必要时对临时目录做合成测试，不访问真实 memory。它的依赖尚未随包安装，不能把依赖缺失当成生产回归。
5. `[ACP]` skill 是否保留目标定位、已有会话不覆盖、共享授权、首条任务不重放、无需重复授权的行为；不要扩展成后台 topic 管理器。
6. 第三方许可证、检查清单及 Git 忽略规则是否足够；不要把“离线通过”描述成“空白 Mac 或生产 E2E 已通过”。

请输出：是否可 private 上传；按严重程度排列的少量可执行问题（触发条件、影响、文件/行号、最小修改）；不阻塞上传的后续项；实际执行的检查和未验证范围。只报告有证据的问题，不要求将全部业务配置、私人 skills 或数据纳入仓库。

UPSTREAM.md 中的条目只是候选。本次不复刻他人已有 PR，也不开始一轮全面上游 rebase。最多指出明显重复或应改为 issue/测试证据的条目。
