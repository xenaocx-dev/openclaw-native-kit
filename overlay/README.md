# 精确版本 overlay

绑定 OpenClaw 2026.9.4、@openclaw/acpx 2026.9.4、claude-agent-acp 0.70.0。20 个 payload 包含 permission/turn/reasoning、MCP 路径、ACP reset、Claude transcript、dispatch ownership、edit recovery 及 ACP ingress adoption 的修改。r3 修改 manager/dispatcher 两项；r3.1 为 adapter 增加修改声明注释。维护者生产环境未改。

```sh
node overlay/overlay.mjs verify \
  --openclaw-root /path/to/node_modules/openclaw \
  --acpx-root /path/to/node_modules/@openclaw/acpx \
  --state-dir /path/to/openclaw-state
```

adapter 默认从 ACPX 邻近 npm 路径发现，其他布局可传 `--adapter-root`。验证不改服务或配置。安装前停稳目标 Gateway，再用相同参数把 verify 换为 apply。未知 package 版本、目标 hash、payload drift 均拒绝。

apply 的备份/journal 在目标 state 的 `patch-backups/<manifest.id>/<timestamp>/`。它不会重启、安装包、写 openclaw.json 或重建 topic。恢复须停稳目标并根据 journal 恢复对应文件；本包没有新增自动回滚工具。

tests/fixtures 中有 14 个获准的修改前源码文件、3 个 r1 payload 和 2 个 r2 payload，供离线测试生成原版、r1 和 r2 安装。辅助文件按创建路径测试；没有整棵 node_modules、生产配置和日志。fixtures 不覆盖 accepts 中每个历史 hash。有关行为测试与真实 E2E 的区别见上级 docs/verification.md。

r1/r2 升级使用相同命令，无需先卸载。原版 9.4 预期为 14 个 ready-replace、6 个 ready-create；完整 r1 预期为 7 个 ready-replace、13 个 installed；完整 r2 预期为 3 个 ready-replace、17 个 installed；完整 r3 为 1 个 ready-replace、19 个 installed（仅 adapter 注释）；完整 r3.1 为 20 个 installed。manifest.id 沿用原系列标识，具体修订以 PACKAGE_FILES.json 的 revision 和 Git commit 为准。apply 不修改配置中的超时、模型或权限。

verify/apply 现在输出四个 `roots`。必须按 `../docs/config-contract.md` 将这些路径与 Gateway、adapter 启动入口和 ACPX peer 解析结果核对；不能把同版本另一份副本的 installed 当作运行时生效。apply 会在指定 state/bin 写入 translator。
