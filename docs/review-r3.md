# r3 增量评审回执

日期：2026-09-18。Fable 5.1 / thinking high 评审候选 `424168e`，基线为 r2 `40a0027`。结论：可以作为下一版候选，没有必须先修的项。原始报告保留在本地 `REVIEW_RESULT.md`，本文件归档结论和处置。

评审确认：manager 的异常捕获范围只覆盖 authoritative 观察回调失败；请求取消、关闭事件流并等待 result 后再抛原错误。dispatcher 在原生接手后、持久化之前标记 replay-unsafe，沿用既有异常、abort 和 abandon 去重处理。原生已启动时，不重试新的 handle 或切换 backend 重跑同一 prompt。

唯一文档建议已处理：在 release-r3 说明 replay-unsafe 对所有经该 dispatcher 的 ACP authoritative prompt start 生效，不限于 Telegram；无渠道 lifecycle 时仍生效，构建 hook 本身不标记。评审后没有改动 payload、测试或配置。

评审实际执行并通过：清单扫描（当时 80 文件 / 20 payload）、npm test（升级与备份、3 项 presentation、adoption-chain、8 项故障用例）、49 个脚本语法检查、两个 r2 fixture 对历史提交的字节比对、Git 忽略和空白检查。独立重跑负对照为 6 失败 / 2 通过；r2 和 r3 的迟到失败空跑均没有取消或 unhandledRejection。

未验证真实 acpx 取消效果、完整 Gateway/Telegram E2E、同 tick 的竞争次序，也未重跑未变化的 helper/ingress 全包测试。既有存储故障恢复及跨崩溃去重局限仍保留，不能把候选评审通过视为生产部署或真实后端验收。

本次文档收尾增加本回执后清单为 81 文件；生产和维护目录未改，尚未上传 GitHub。
