// Isolated OpenClaw 2026.9.3 / Claude ACP 0.70.0 integration only.
// Native Claude decides Auto; this translates the remaining human questions.
export async function requestPermissionForm(client, params, toolName, signal) {
  const cancelled = () => ({ outcome: { outcome: "cancelled" } });
  if (signal.aborted) return cancelled();
  // Do not add persistent grants or bypass choices through this compatibility path.
  const options = params.options.filter(o => o.kind === "allow_once" ||
    o.kind === "reject_once" || (toolName === "ExitPlanMode" && o.optionId === "auto"));
  if (options.length < 2 || options.length > 4) return cancelled();
  const input = JSON.stringify(params.toolCall.rawInput ?? {});
  const message = `Claude 请求确认：${toolName} ${input}`;
  // The official form compiler caps the intro at 1024. Never truncate an action
  // and then invite approval for the unseen remainder.
  if (message.length > 1024) throw new Error("Claude permission request exceeds the OpenClaw form limit; action was not approved.");
  const response = await client.unstable_createElicitation({
    mode: "form", sessionId: params.sessionId, toolCallId: params.toolCall.toolCallId,
    message,
    requestedSchema: {
      type: "object", required: ["decision"],
      properties: { decision: { type: "string", title: "操作授权", oneOf: options.map(o => ({
        const: o.optionId,
        title: o.kind === "reject_once" ? "拒绝本次" : o.optionId === "auto" ? "确认计划并使用 Auto" : "允许本次"
      })) } }
    }
  }, signal);
  const selected = response?.content?.decision;
  if (signal.aborted || response?.action !== "accept" ||
      !options.some(o => o.optionId === selected)) return cancelled();
  return { outcome: { outcome: "selected", optionId: selected } };
}

// Port of openclaw-acp-true-stream-v2: channel-owned terminal finalization.
// Preview snapshots and a separate terminal reasoning payload reuse Telegram's
// own draft, paging, authorization and delivery machinery. No model calls here.
export function createReasoningForwarder(params) {
  const enabled = params.enabled === true;
  let text = "";
  let truncated = false;
  let closed = false;
  const finish = async () => {
    const completed = text + (truncated ? "\n[Reasoning 超过 24,000 字符，展示已截断。]" : "");
    text = "";
    truncated = false;
    if (!completed || params.signal?.aborted) return;
    try {
      const payload = { text: completed, isReasoning: true,
        channelData: { openclawAcpReasoningFinal: true } };
      // The channel owns finalizing its live preview. Only use a separate
      // durable payload when there is no preview finalizer (e.g. reasoning on).
      let retained = false;
      if (params.durable === true && params.onFinalize) {
        try { retained = await params.onFinalize(payload) === true; }
        catch { params.onError?.("retain"); }
      }
      if (params.durable === true && !retained) await params.deliver("tool", payload, { skipTts: true });
      await params.onEnd?.();
    } catch { params.onError?.("final"); }
  };
  return {
    async onEvent(event) {
      if (!enabled || closed || params.signal?.aborted) return;
      if (event.type === "text_delta" && event.stream === "thought" && event.tag === "agent_thought_chunk") {
        if (typeof event.text !== "string") return;
        // Bound a single reasoning block independently of answer text.
        const remaining = 24000 - text.length;
        let append = event.text.slice(0, remaining);
        if (append.length < event.text.length && /[\uD800-\uDBFF]$/.test(append)) append = append.slice(0, -1);
        truncated ||= append.length < event.text.length;
        if (!append) return;
        text += append;
        try { await params.onStream?.({ text, isReasoningSnapshot: true }); }
        catch { params.onError?.("preview"); }
      } else if ((event.type === "text_delta" && (!event.stream || event.stream === "output")) ||
                 event.type === "tool_call" || event.type === "done") {
        if (event.type === "done") {
          closed = true;
          if (event.status === "cancelled") { text = ""; truncated = false; return; }
        }
        await finish();
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      await finish();
    }
  };
}

// A language preference for provider-exported summaries; no translation model.
export function nativeSummaryLanguagePrompt(prompt, language) {
  if (language !== "zh-CN") return prompt;
  const instruction = "面向用户展示的推理摘要和最终回答优先使用简体中文；代码、模型 ID 与必要专有名词保留原文。不要在正文重复推理摘要。";
  if (typeof prompt === "string") return prompt + "\n\n" + instruction;
  if (prompt?.type === "preset") return { ...prompt,
    append: [prompt.append, instruction].filter(Boolean).join("\n\n") };
  return prompt;
}
