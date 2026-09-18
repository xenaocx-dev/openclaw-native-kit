# 2026.9.4 r2 — 本地候选

日期：2026-09-18。基于已 private 归档的 r1（`c3101af`），准备增量评审；本轮不上传、不打 tag、不发布 Release。

## 修复的具体问题

原生 ACP 已开始任务后，OpenClaw 入站队列没有收到完整的接管通知，长回合可能被仍在计时的接管 watchdog 中断。r2 复用已部署修复，将通知贯通 dispatcher → ACP hook → ACP dispatch → manager，仅在原生 `promptStarted` 为 authoritative 时通知队列。

真正尚未接管就卡住时，Telegram drain 产生带 update identity 的 `TELEGRAM_SPOOLED_HANDLER_TIMEOUT`，使已有 reasoning 收尾逻辑能识别。未新增翻译层、权限机制或配置键，也未修改超时时长。接管 watchdog 和原生任务运行时限是两回事，本修复不保证所有长任务都不会超时。

## 相对 r1 的 payload 差异

| 类型 | 文件 | 变化 |
|---|---|---|
| 更新 | dispatch-from-config-CmAXENud.mjs | 转发 onTurnAdopted |
| 更新 | acpx-BDOdDqge.mjs | 转发 onTurnAdopted |
| 更新 | dispatch-acp-txw_fKCF.mjs | 转发 onTurnAdopted |
| 新增目标 | manager-DTkVUGeR.mjs | authoritative promptStarted 通知接管 |
| 新增目标 | ingress-drain-HjcOOU41.mjs | 支持渠道提供超时 Error，异常时保底 |
| 新增目标 | telegram-ingress-drain-factory-EIOjXZiY.mjs | 生成带 Telegram 标识的超时 Error |

共 3 个既有文件更新、3 个新增目标，其余 14 个 payload 不变。新增目标也是原安装已有文件，不是新增服务。版本仍为 OpenClaw / ACPX 2026.9.4、Claude adapter 0.70.0。安装器、配置模板、权限、memory helper 和模型默认值不变。

## 验证与发布门槛

- 默认离线检查：原版安装、r1 → r2 仅 6 项替换、原字节备份、幂等、版本/未知改动拒绝、3 项中文展示合成用例、authoritative 接管及 ACP hook 转发。
- 可选 ingress 合成检查：使用已有完整 9.4 包的依赖，验证接管后不误超时、真正接管超时进入可重试路径并被 reasoning matcher 识别。没有真实渠道或模型调用。
- 只读生产 verify：20/20 installed，全部 payload 与安装文件相同。此项证明文件一致，不能单独证明当前进程加载状态或自然长回合表现。
- r1 的 helper/MCP 检查作为历史证据保留；未更改 helper，r2 不重复该验收。

不要求新建空白 Mac、不重跑整套 Telegram E2E。自然使用作为持续运行证据；只有本次改动出现新问题才扩大检查。待 Fable 增量 review 通过后再进入 private 上传。公开发布及自有代码许可证另行决定。
