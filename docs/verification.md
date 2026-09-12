# 验证范围

## 本包新增或调整

- overlay payload 不改，使用原有 version/hash 拒绝逻辑。
- 测试的源文件从本机安装依赖换为包内固定 fixture，并补未知版本/改动拒绝检查。
- 复用原有 presentation 测试，仅改 import 路径。
- memory helper 依赖从旧全局安装绝对路径换为包依赖；workspace/source 必须显式提供。不改变生产 helper。
- JSON 与 CLAUDE/skill 文本为脱敏模板，需在目标机器完整合并并校验。静默插件代码不改。

## 已有运行证据与保留缺口

迁移记录已验证普通 Claude CLI 多轮、OpenClaw memory 检索、ACP topic 绑定、`/new` 后会话可用，以及中文 reasoning 实时增长并留存。测试 topic 的真实代码任务与追问由用户完成。

近期 dispatcher guard 的公共 dispatcher 合成回归和 Telegram edit recovery 合成测试已有通过记录，但本包未打包整棵运行时来重演它们。presentation 测试仅涵盖摘要/附件提交及清理顺序，不能代替 known-ID 编辑失败的完整渠道测试。

BNB 迁移保留原生会话，验证零提示恢复、Fable/Auto/high、工具发现与独立 memory 检索；真实业务长回合、memory_propose 写入及 Telegram 全链路还需在自然使用中确认，不能把初始化当成业务验收。

## review 后的隔离重建最小验收

1. 精确版本和完整候选 config validate；overlay 全部 installed。
2. 普通 topic 按指定模型回复、同会话追问、实际 memory_search。
3. 共享 ACP topic owner/runtime 正确；workspace 写入、实际插件 memory 调用、一个真实任务和追问。
4. `/new` 后绑定仍正确且可回复；中文 reasoning 实时刷新并按设定保留；取消后不跨 runtime 重放任务。
5. 独立 owner 的 memory 不命中共享索引；Auto 的审批与实际可用工具核验，不能推断为操作系统级隔离。

只有这几项暴露新问题再扩大测试。不要重复历史完整迁移矩阵；不要为证明打包成功在生产发送验收消息。
