@AGENTS.md

# 独立 topic 项目模板

此 owner 与 cwd 均为 `__ISOLATED_WORKSPACE__`，记忆范围为 `__ISOLATED_SCOPE__`。AGENTS.md 由用户填写本 topic 规则，不能从共享 workspace 原样复制私人内容。

OpenClaw memory_search / memory_get 按此 owner 的独立 workspace 索引；不配置共享目录 extraPaths。若启用 topic_memory MCP，使用其 memory_search/get/propose；propose 将经授权的内容追加到本 topic memory Markdown。不要将本 topic 记忆写回共享 workspace。此服务是限定文件的关键词检索/追加器，与 OpenClaw 本地向量索引是两条不同接口。

这里采用原生 Auto，不再运行旧权限 loader。记忆规则和路径限制不能作为整个 Claude 进程的安全沙箱承诺。只链接明确准许本 topic 使用的 skills，读取后按本任务授权调用；其他 OpenClaw 操作使用 `__OPENCLAW_CLI__`。

普通回复由 OpenClaw 自动投递，不手动重复发送。原生 reasoning 交给展示层，不手写 `<think>`。不重置或替换已有会话；迁移原会话另行处理，不能把创建此模板当作会话恢复验收。
