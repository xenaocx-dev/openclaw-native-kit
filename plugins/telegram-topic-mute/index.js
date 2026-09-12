import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

function norm(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function pluginConfig(value) {
  if (!value || typeof value !== "object") return {};
  return value;
}

function ruleMatches(rule, event, ctx) {
  const channel = norm(rule.channel);
  const target = norm(rule.target);
  const threadId = norm(rule.threadId);
  if (!channel || !target || !threadId) return false;
  if (norm(ctx.channelId || event.metadata?.channelId) !== channel) return false;
  if (rule.accountId !== undefined && norm(ctx.accountId) !== norm(rule.accountId)) return false;
  if (norm(event.to) !== target && norm(ctx.conversationId) !== target && norm(event.metadata?.conversationId) !== target) return false;
  const eventThreadId = norm(event.threadId || event.metadata?.threadId || event.metadata?.message_thread_id);
  if (eventThreadId !== threadId) return false;
  return true;
}

function sessionKeyMatches(rule, event, ctx) {
  const channel = norm(rule.channel);
  const target = norm(rule.target);
  const threadId = norm(rule.threadId);
  if (!channel || !target || !threadId) return false;
  if (norm(ctx.channelId || event.channel) !== channel) return false;
  if (rule.accountId !== undefined && norm(ctx.accountId) !== norm(rule.accountId)) return false;
  if (norm(ctx.conversationId) !== target) return false;
  const sessionKey = norm(ctx.sessionKey || event.sessionKey);
  const topicKey = `:${channel}:group:${target}:topic:${threadId}`;
  return sessionKey.endsWith(topicKey) || sessionKey.includes(`${topicKey}:`);
}

function findMatchingRule(rules, event, ctx) {
  return rules.find((rule) => rule && typeof rule === "object" && (ruleMatches(rule, event, ctx) || sessionKeyMatches(rule, event, ctx)));
}

export default definePluginEntry({
  id: "telegram-topic-mute",
  name: "Telegram Topic Mute",
  description: "Suppress OpenClaw replies to configured Telegram group topics.",
  register(api) {
    api.on("before_dispatch", async (event, ctx) => {
      const cfg = pluginConfig(api.pluginConfig);
      const rules = Array.isArray(cfg.rules) ? cfg.rules : [];
      const matched = findMatchingRule(rules, event, ctx);
      if (!matched) return;
      const reason = norm(matched.reason) || "telegram topic muted";
      api.logger.info?.(`telegram-topic-mute: handled inbound for ${norm(ctx.conversationId)} session ${norm(ctx.sessionKey)} (${reason})`);
      return {
        handled: true
      };
    });

    api.on("message_sending", async (event, ctx) => {
      const cfg = pluginConfig(api.pluginConfig);
      const rules = Array.isArray(cfg.rules) ? cfg.rules : [];
      const matched = findMatchingRule(rules, event, ctx);
      if (!matched) return;
      const reason = norm(matched.reason) || "telegram topic muted";
      api.logger.info?.(`telegram-topic-mute: cancelled send to ${norm(event.to)} thread ${norm(event.threadId)} (${reason})`);
      return {
        cancel: true,
        cancelReason: reason
      };
    }, { registrationId: "telegram-topic-mute:route-only:v1" });
  }
});
