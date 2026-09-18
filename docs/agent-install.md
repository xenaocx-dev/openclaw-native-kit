# 给 Codex / Claude Code 的安装任务

目标用户已有 OpenClaw。把下面任务交给本机 Agent，并说明本包目录、目标实例及希望使用共享还是独立 memory。无需先清空机器或重建已有实例。

> 请按本仓库 README、overlay/README 和 docs/config-contract 协助安装。
>
> 先只读确认正在运行的 Gateway、OpenClaw / ACPX / Claude adapter 的真实路径与版本、state、认证状态及目标 workspace。不要输出凭据或对话。列出当前环境与要求的差异；版本不符时停止套补丁，不能通过改 manifest 或接受未知 hash 绕过校验。
>
> 运行 `node scripts/check-package.mjs` 和 `npm test`。然后对选定安装执行 overlay verify，报告四个 roots、待替换/创建项和拒绝项；按 config-contract 核对 adapter 启动入口及 ACPX 的 openclaw peer 解析指向同一套包。仅检查版本号不够。
>
> 根据用户选定的 topic 和 memory 范围准备最小配置合并，保留已有 agents、bindings、认证和业务数据。已有有效认证不重做。用官方 config validate 检查完整候选配置。模型 ID、Ollama、skills 和 Obsidian 只启用本机可用且用户需要的部分。
>
> 在已有授权和约定维护窗口内，停稳选定目标、apply 并保存备份 journal 路径；未获准中断服务时先交付具体改动供确认。重启该目标后确认加载路径及 overlay installed 状态。不要影响其他安装或话题。
>
> 只对新接入部分做最小自然任务确认；不要重复整套迁移测试或向其他 topic 发消息。最后报告实际改动、验证证据、未验证项，以及按 journal 恢复对应文件的方法。不要创建自动升级服务或新增测试框架。

`[ACP]` 是配置好后的 skill 触发约定，不是全新安装的自举命令。普通模型 fallback 不代表 ACP 跨 harness fallback；Astra ACP 行为尚未验收。可用工具、共享 memory 和宿主权限边界见 README，不能承诺完整 Claude Desktop UI 或强安全隔离。
