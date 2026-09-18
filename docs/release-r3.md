# 2026.9.4 r3 — 接管通知失败修复候选

日期：2026-09-18。基线为已 private 上传的 r2 `40a0027`。本候选仅本地提交，待 Fable 5.1 high 增量评审；未同步维护目录、部署生产或上传 GitHub。

## 问题与修复

r2 新增的 authoritative 接管通知可能在原生 prompt 已被接受后抛错。旧代码会直接退出 manager，未请求取消原生 turn；若 dispatcher 的异常路径仍认为可以重放，还会释放去重记录。接管持久化开始后 ingress 已清除 watchdog，所以不能依赖该 watchdog 处理这类存储失败。

本次只修改两个已有目标，其余 18 个 payload 不变：

- `manager-DTkVUGeR.mjs`：捕获等待 prompt readiness 时的观察回调异常，停止转发后续事件，请求取消并关闭事件流，等待原生 result 后再抛出原错误。原生 prompt 自身拒绝及正常完成的处理不变；原生已完成、通知稍后才失败时不再发起取消。
- `dispatch-from-config-CmAXENud.mjs`：原生报告接手时，先调用现有 `markInboundDedupeReplayUnsafe`，再等待 ingress 接管通知。即使通知失败，后续 dispatcher 异常路径也提交去重记录，不释放已不可安全重放的消息。没有把持久化失败伪装成接管成功。

安装器、权限、认证、配置和超时值不变。manifest 仍为 20 项，增加两个 r2 hash 到 accepts。完整 r2 的 verify 应显示 2 个 ready-replace、18 个 installed；apply 和备份仅涉及这两个目标。

## 验证

`npm test` 新增 8 项故障模拟，执行从候选 payload 提取的真实 turn-stream、manager 接管回调、dispatcher hook、异常去重分支及 ingress 持久化代码。原生进程、去重存储和队列为内存替身；持久化重试的等待被移除，8 次重试逻辑不变。

覆盖通知抛错、被 supersede/guillotine 的通知、取消 RPC 拒绝、正常完成、迟到的通知失败、异常去重，以及 8 次持久化失败后保留 claim。结果 8/8 通过。相同测试放回未修改 r2 文件后为 6 项失败、2 项正常路径通过，证明回归用例能识别原问题。

原版安装、r1 → r3、r2 → r3、备份字节、幂等、版本/未知文件拒绝和原有中文展示测试通过。生产只读 verify 显示 18 installed / 2 ready-replace，与未部署状态相符。

## 证据边界

这不是完整 Gateway/Telegram E2E，也未测试真实模型是否服从取消。取消请求失败或原生永不返回时，仍由已有 manager 任务时限处理，不能保证强制结束宿主进程。已执行的副作用不会被撤销。

持久化持续失败时，现有 ingress 保留 claim，可能阻塞该 lane，需要恢复存储后处理。本修复防止当前运行中的任务被提前遗弃及本进程 dispatcher 释放去重；不提供跨崩溃的 exactly-once 保证，不新增恢复、重放或后台重试机制。
