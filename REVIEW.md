# r3 接管失败修复评审

建议模型：**Fable 5.1，thinking high**。以已 private 上传的 `40a0027` 为基线，只审当前 r3 增量。目标是确认这两处修改是否足以修复 r2 评审 P1，且没有引入新的取消或重放问题。无需多 agent。

先读 `docs/release-r3.md`，查看：

```sh
git diff 40a0027 -- overlay/payload overlay/manifest.json
node scripts/check-package.mjs
npm test
```

只报告有证据的问题，报告写入当前目录 `REVIEW_RESULT.md`。不修改代码、不安装依赖、不访问生产凭据或业务数据、不启动/重启 Gateway、不发送 Telegram 消息、不提交 Git、不上传、不发布 issue/PR。无需再次审查全部 18 个未变 payload、helper 或配置模板，也无需建新环境。

重点核对：

1. manager 在 authoritative 回调失败时是否请求取消、关闭事件流，并在原生 result 到达前保留任务所有权；原错误是否被保留。取消请求失败、原生先完成、通知迟到、prompt 自身拒绝和外层既有超时分别如何处理。不要把“请求取消”当作真实后端已停止。
2. dispatcher 是否仅在原生报告接手后标记 replay-unsafe；标记是否先于可能失败的持久化回调，是否沿用现有异常/abandon/abort 去重逻辑。没有真正接手的消息不应因构建 hook 就被提交。
3. ingress 持久化失败时 watchdog 已清除、claim 被保留的事实是否与文档相符；不得把本进程去重说成跨崩溃 exactly-once。本轮没有重设计存储故障恢复。
4. 新测试执行的实际代码与替身边界是否足以支持结论。取消等待、去重、8 次 tombstone 失败、正常完成与迟到通知均有用例；完整 dispatcher/Telegram E2E 未运行。r2 原文件的负对照应为 6 项失败、2 项正常路径通过。
5. manifest 只更新两个 payload hash 并接受 r2 hash；r2 升级只替换两项、备份原字节并且幂等。补丁与 fixture 不应含私人数据。

输出：是否可作为下一版候选；必须先修的问题及最小建议；哪些发现只是原有局限；实际验证和未验证范围。生产部署、private 上传须另行推进，不因为评审通过就自动执行。
