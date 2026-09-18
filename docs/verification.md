# 验证范围

## r3.1 公开分享包装

r3.1 不改执行逻辑，只给 adapter 加修改声明注释，并补许可证、第三方 notices 和分享说明。默认测试覆盖原版安装及 r1/r2/r3 升级；补丁目标仍为 20。新增注释之外的 adapter 字节已与 r3 比对一致。Git 历史、当前清单和发布归档分别做基础凭据/路径扫描，不能视为穷尽安全审计。

本次结果见 `docs/packaging-checks-r3.1.json`；下方 r3 记录是此前修复候选的证据，不代表已生产部署。

## r3 当前候选

r3 只修改 manager 和 dispatcher 两个已有 payload，针对接管回调异常进行取消/收尾与去重保护。详见 `docs/release-r3.md`；其余 r2 payload、安装器和配置不变。

默认 `npm test` 增加 8 项异常模拟和 r2 → r3 两文件升级验证。新用例执行真实代码片段，使用假的原生 turn、内存队列及去重存储；不是完整 Gateway E2E。持久化重试只移除了等待，次数及失败分支不改。相同用例对未修改 r2 为 6 失败 / 2 通过，对候选为 8 通过。

当前生产只读 verify 为 18 installed、2 ready-replace；不能再将 r2 的 20/20 installed 历史结果用于证明 r3 已部署。当前记录在 `docs/packaging-checks.json`，r2 记录保存在 `docs/packaging-checks-r2.json`。

## r2 历史新增或调整

- r2 从已部署维护版同步 6 个文件变化（3 更新、3 新目标），其余 14 个 payload 不变；安装器及 version/hash 拒绝逻辑不改。
- 接管回调成功也会提交 dispatcher 的已接管状态，改变后续失败的 dedupe 处理，避免释放并重放已接手消息。回调抛错仍有已知窗口，见 `docs/release-r2.md`；现有抛错断言记录当前行为，不证明此路径安全。
- 测试的源文件从本机安装依赖换为包内固定 fixture，并补未知版本/改动拒绝检查。
- 复用原有 presentation 测试，仅改 import 路径。
- memory helper 依赖从旧全局安装绝对路径换为包依赖；workspace/source 必须显式提供。不改变生产 helper。
- JSON 与 CLAUDE/skill 文本为脱敏模板，需在目标机器完整合并并校验。静默插件代码不改。

## r2 本地检查

`node scripts/check-package.mjs` 与 `npm test` 是默认检查。后者覆盖原版安装和 r1 升级、备份与幂等，并复用已有 presentation 和接管回调的合成用例。adoption-chain 测试执行真实 manager 回调与 ACP hook 的提取代码；其余两段转发为源码断言，不能称为完整 dispatcher 端到端测试。

已有完整 OpenClaw 2026.9.4 包时，可额外运行：

```sh
OPENCLAW_TEST_ROOT=/path/to/node_modules/openclaw npm run test:ingress
```

该测试从指定包只读加载 ingress 的依赖，通过加载钩子替换成候选 ingress payload，以内存队列模拟接管和超时；reasoning matcher 从候选 payload 加载。无需安装插件、启动 Gateway、写生产 state、访问 Telegram 或调用模型。环境变量必须指向精确版本；不要为此额外重建一台机器。

r2 结果见 `docs/packaging-checks-r2.json`；r1 历史记录见 `docs/packaging-checks-r1.json`。当时对生产执行的 overlay verify 仅证明 r2 磁盘文件 20/20 相同，不证明当前进程加载状态；没有把旧自然使用证据表述为本轮重跑 E2E。

## 已有运行证据与保留缺口

迁移记录已验证普通 Claude CLI 多轮、OpenClaw memory 检索、ACP topic 绑定、`/new` 后会话可用，以及中文 reasoning 实时增长并留存。测试 topic 的真实代码任务与追问由用户完成。

近期 dispatcher guard 的公共 dispatcher 合成回归和 Telegram edit recovery 合成测试已有通过记录，但本包未打包整棵运行时来重演它们。presentation 测试仅涵盖摘要/附件提交及清理顺序，不能代替 known-ID 编辑失败的完整渠道测试。

BNB 迁移保留原生会话，验证零提示恢复、Fable/Auto/high、工具发现与独立 memory 检索；真实业务长回合、memory_propose 写入及 Telegram 全链路还需在自然使用中确认，不能把初始化当成业务验收。

## 新用户完成接入后的最小验收参考

以下用于新接入的功能；本次 r2 打包不重复已经工作的生产功能或完整矩阵。

1. 精确版本和完整候选 config validate；overlay 全部 installed。
2. 普通 topic 按指定模型回复、同会话追问、实际 memory_search。
3. 共享 ACP topic owner/runtime 正确；workspace 写入、实际插件 memory 调用、一个真实任务和追问。
4. `/new` 后绑定仍正确且可回复；中文 reasoning 实时刷新并按设定保留；取消后不跨 runtime 重放任务。
5. 独立 owner 的 memory 不命中共享索引；Auto 的审批与实际可用工具核验，不能推断为操作系统级隔离。

只有这几项暴露新问题再扩大测试。不要重复历史完整迁移矩阵；不要为证明打包成功在生产发送验收消息。
