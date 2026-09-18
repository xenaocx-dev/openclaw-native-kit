# 分享介绍

## 给使用者

OpenClaw Native Kit 是一套给现有 OpenClaw 用户使用的配置模板和兼容补丁：让 Telegram 等渠道的 ACP 会话运行原生 Claude Code，并接入 OpenClaw 的记忆与部分工具能力，提供原生 reasoning 推流和本地中文整理、摘要及留存。

将安装任务交给本机 Codex / Claude Code 即可按步骤检查环境、定位安装、合并配置和应用补丁。它不是一键安装器，也不是 Claude Desktop 界面的复刻。当前只支持 OpenClaw / ACPX 2026.9.4 与 Claude adapter 0.70.0；模型要在你的账号中可用，示例里的 Fable/Astra 名称不是所有用户都能直接使用。已有有效登录无需重做。

入口：[安装任务](agent-install.md) · [发布下载](https://github.com/xenaocx-dev/openclaw-native-kit/releases/tag/v2026.9.4-r3.1)

## 给开发者

这是精确版本绑定的 OpenClaw ACP compatibility overlay，包含 20 个目标文件、已知源 hash 白名单、apply 前校验、文件备份和离线回归测试。r3 修复原生 prompt 已接受后接管通知失败时的取消/收尾及 dispatcher 去重保护；r3.1 只补公开分发许可证、文件修改声明和文档，不改运行逻辑。

配置模板覆盖 topic 绑定、共享或独立 memory、原生 Auto 权限及工具接入约定。普通模型 fallback 不代表 ACP 跨 harness fallback；Astra ACP 尚未验收。此包不包含业务数据或凭据，也不提供强跨 topic 沙箱。

自有内容 MIT，第三方文件保留 MIT / Apache-2.0。欢迎具体的版本适配与回归证据。OpenClaw 升级后须重新比对源码、hash 和行为，不能改 manifest 版本号后硬套；上游已修的内容优先移除本地补丁，不扩大成自动升级框架。
