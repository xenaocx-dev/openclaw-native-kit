// Presentation copied from audited v3.8; dependencies supplied by the 9.3 bridge.
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const sliceUtf16Safe=(s,start,end)=>{let out=s.slice(start,end);return /[\uD800-\uDBFF]$/.test(out)?out.slice(0,-1):out;};
export function createChinesePresentation(deps) {
 const {telegramDeps,deliverReplies,deliveryBaseOptions,sendRecordVoice,bot,chatId,cfg,route,editMessageTelegram,mediaLocalRoots,resolveStateDir,logVerbose,formatErrorMessage}=deps;
	const escapeAcpReasoningHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	const buildAcpReasoningChinesePresentation = ({ summaryZh, fullZh }) => {
		const summary = summaryZh.trim();
		const full = fullZh.trim();
		const render = (label, foldedText) => `<b>🧠 推理摘要</b>\n${escapeAcpReasoningHtml(summary)}\n\n<blockquote expandable><b>${label}</b>\n\n${escapeAcpReasoningHtml(foldedText)}</blockquote>`;
		const inlineHtml = render("完整推理（中文）", full);
		if (inlineHtml.length <= 3900) return {
			inline: true,
			html: inlineHtml
		};
		const suffix = "\n\n……完整中文推理见附件。";
		let low = 0;
		let high = Math.min(full.length, 900);
		let foldedText = suffix.trimStart();
		while (low <= high) {
			const middle = Math.floor((low + high) / 2);
			const candidate = `${sliceUtf16Safe(full, 0, middle).trimEnd()}${suffix}`;
			if (render("完整推理节选（中文）", candidate).length <= 3900) {
				foldedText = candidate;
				low = middle + 1;
			} else high = middle - 1;
		}
		return {
			inline: false,
			html: render("完整推理节选（中文）", foldedText)
		};
	};
	const sendAcpReasoningChineseDocument = async ({ filePath, replyToId }) => {
		const result = await (telegramDeps.deliverReplies ?? deliverReplies)({
			...deliveryBaseOptions,
			transcriptMirror: void 0,
			replies: [{
				text: "完整中文推理（Markdown）",
				mediaUrl: filePath,
				replyToId
			}],
			onVoiceRecording: sendRecordVoice,
			silent: false,
			mediaLoader: telegramDeps.loadWebMedia
		});
		if (!result.delivered) throw new Error("Chinese reasoning document delivery was not confirmed");
	};
	const cleanupAcpReasoningMessagesExcept = async (messageIds, retainedMessageId) => {
		let cleanedMessages = 0;
		for (const messageId of messageIds.filter((candidate) => candidate !== retainedMessageId)) try {
			if (await bot.api.deleteMessage(chatId, messageId) === true) cleanedMessages += 1;
		} catch (error) {
			logVerbose(`telegram: ACP Chinese reasoning placeholder cleanup failed: ${formatErrorMessage(error)}`);
		}
		return cleanedMessages;
	};
	const startAcpReasoningChinesePresentation = ({ sourceText, primaryMessageId, messageIds, canonicalMessageCount, traceMode }) => {
		return (async () => {
			const startedAt = Date.now();
			let chineseDocumentDelivered = false;
			let primaryCommitted = false;
			try {
				const finalizerPath = path.join(resolveStateDir(), "bin", "openclaw-acp-reasoning-cn.mjs");
				const { finalizeReasoningChinese } = await import(finalizerPath);
				if (typeof finalizeReasoningChinese !== "function") throw new Error("Chinese reasoning finalizer export is unavailable");
				const translated = await finalizeReasoningChinese(sourceText, { timeoutMs: 6e5 });
				const presentation = buildAcpReasoningChinesePresentation(translated);
				if (!presentation.inline) {
					const fs = await import("node:fs/promises");
					const exportDir = path.join(mediaLocalRoots[0], "reasoning-exports");
					await fs.mkdir(exportDir, {
						recursive: true,
						mode: 0o700
					});
					await fs.chmod(exportDir, 0o700);
					const filePath = path.join(exportDir, `reasoning-zh-${randomUUID()}.md`);
					const markdown = `# 完整推理（中文）\n\n> 本文件由本机离线模型根据会话中已显示的推理文字翻译生成；代码、命令、路径和链接保持原样。\n\n## 摘要\n\n${translated.summaryZh.trim()}\n\n## 全文\n\n${translated.fullZh.trim()}\n`;
					await fs.writeFile(filePath, markdown, {
						encoding: "utf8",
						mode: 0o600,
						flag: "wx"
					});
					try {
						await sendAcpReasoningChineseDocument({
							filePath,
							replyToId: primaryMessageId
						});
						chineseDocumentDelivered = true;
					} finally {
						await fs.unlink(filePath).catch(() => void 0);
					}
				}
				await (telegramDeps.editMessageTelegram ?? editMessageTelegram)(chatId, primaryMessageId, presentation.html, {
					api: bot.api,
					cfg,
					accountId: route.accountId,
					linkPreview: false,
					textMode: "html"
				});
				primaryCommitted = true;
				const cleanedMessages = await cleanupAcpReasoningMessagesExcept(messageIds, primaryMessageId);
				console.warn(`[acp-reasoning-cn-v3.5] completed trace=${traceMode} mode=${presentation.inline ? "inline" : "attachment"} sourceChars=${sourceText.length} translatedChars=${translated.fullZh.length} canonical=${canonicalMessageCount} cleanup=${messageIds.length} cleaned=${cleanedMessages}/${Math.max(0, messageIds.length - 1)} ms=${Date.now() - startedAt}`);
			} catch (error) {
				let failureNoticeCommitted = primaryCommitted;
				let retainedMessageId = primaryCommitted ? primaryMessageId : void 0;
				if (!primaryCommitted) for (const messageId of messageIds) try {
					await (telegramDeps.editMessageTelegram ?? editMessageTelegram)(chatId, messageId, "🧠 中文推理整理失败；原始推理仍保留在本地 ACP 会话记录中。", {
						api: bot.api,
						cfg,
						accountId: route.accountId,
						linkPreview: false
					});
					failureNoticeCommitted = true;
					retainedMessageId = messageId;
					break;
				} catch (noticeError) {
					logVerbose(`telegram: ACP Chinese reasoning failure notice edit failed (${messageId}): ${formatErrorMessage(noticeError)}`);
				}
				const cleanedMessages = failureNoticeCommitted ? await cleanupAcpReasoningMessagesExcept(messageIds, retainedMessageId) : 0;
				console.warn(`[acp-reasoning-cn-v3.5] failed trace=${traceMode} notice=${failureNoticeCommitted} canonical=${canonicalMessageCount} cleanup=${messageIds.length} cleaned=${cleanedMessages}/${Math.max(0, messageIds.length - 1)} keptChineseDocument=${chineseDocumentDelivered}: ${formatErrorMessage(error)}`);
			}
		})();
	};

 return {start:startAcpReasoningChinesePresentation, render:buildAcpReasoningChinesePresentation};
}
