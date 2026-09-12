# 首次评审后的修订回执 r1

2026-09-13。首次 Fable 5.1/high 评审允许 private 上传；本修订只处理输出、文档与扫描检查。原 REVIEW_RESULT.md 未修改，其 SHA256 为 `6a2442095f3275d8b1b9a29551f03227216884297d7cb0964a4b2f0d82d8ed40`。原评审报告仍是本地文件，不随上传包分发。

| 评审项 | 处理 |
|---|---|
| P1 副本不明确 | verify/apply JSON 增加四个 roots；config-contract 明确 Gateway 安装、adapter 实际入口及 state 必须一致。隔离 CLI verify/apply 输出断言通过。工具没有自动读取或绑定生产服务。 |
| P2 peer 前提缺失 | 增加与 payload 相同的 createRequire 核对命令和修复依赖流程；隔离测试覆盖无 peer 抛错、正确 peer 解析以及不同 root 不相等。UPSTREAM 明确不能照搬本地一行修改。没有改成自动回退，没有新增全套验证器。 |
| P3 环境契约 | 增加六个变量的组件、默认行为及覆盖限制，明确固定 translator 模型。 |
| P4 helper 通用化残留 | 保留旧去重标记、日期时区和合成自测词，注明兼容原因；不把上传前整理扩成记忆格式迁移。 |
| P5 脱敏与忽略规则 | scanner 增加 Telegram 群标识和 macOS 用户目录模式，保留已有 example fixture 例外；增加 .mcp.json、.claude/、first-task.md 忽略。临时副本中注入合成标识，实际 scanner 均拒绝；交付文件未被 Git 误忽略。 |
| P6 文档入口 | 增加完整占位符表及 OPERATIONS_DIR；skill 不再依赖旧 wrapper 说明；明确 AGENTS.md 与 translator 写入位置。payload 旧版本注释留待源码重建。 |

17 个 payload 与首次评审清单完全相同，manifest 未改；生产配置、运行时、session 和 helper 未修改。新改动仅为打包工具输出、对应隔离测试、扫描规则和文档。没有重新安装依赖或发送 Telegram 消息。

第一轮的 presentation 和 helper 测试仍适用于未变更文件；本轮重新运行相关 overlay 测试、scanner 负向用例、Git 忽略检查和全包 hash/JSON 扫描。空白 Mac、官方完整 config validate、真实 Telegram E2E、Astra ACP 及最新上游 main 仍未新验证。

原压缩包保留作首次评审基线；带 `.r1.tar.gz` 后缀的压缩包为本次修订。上传应使用当前目录或 r1 包。自有许可证和 Apache 修改声明等公开分发问题仍须在公开发布前处理；本次只准备 private 上传。
