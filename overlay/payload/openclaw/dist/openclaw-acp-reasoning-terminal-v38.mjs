// Extracted unchanged from the audited v3.11 composite Telegram v3.8.
//#region local-patch: acp-reasoning-timeout-v3.4
const TELEGRAM_SPOOLED_HANDLER_TIMEOUT_ABORT_CODE = "TELEGRAM_SPOOLED_HANDLER_TIMEOUT";
const TELEGRAM_ACP_REASONING_TIMEOUT_NOTICE = "🧠 本轮已达到 Telegram 处理时限，推理推流已停止。如尚未看到最终回复，已产生的推理与任务进度仍保留在本地会话记录中；发送“继续”即可续跑。";
const TELEGRAM_ACP_REASONING_TIMEOUT_FINALIZE_BUDGET_MS = 4e3;
const TELEGRAM_ACP_REASONING_TIMEOUT_DISCARD_BUDGET_MS = 250;
const TELEGRAM_ACP_REASONING_TIMEOUT_MAX_RECONCILIATIONS = 4;
function isTelegramSpooledHandlerTimeoutAbortReason(reason, telegramUpdateIds) {
	if (!reason || typeof reason !== "object" || reason.code !== TELEGRAM_SPOOLED_HANDLER_TIMEOUT_ABORT_CODE) return false;
	const reasonUpdateId = reason.updateId;
	if (!Number.isSafeInteger(reasonUpdateId)) return false;
	const candidates = typeof telegramUpdateIds === "number" ? [telegramUpdateIds] : telegramUpdateIds;
	return candidates != null && [...candidates].some((updateId) => Number.isSafeInteger(updateId) && updateId === reasonUpdateId);
}
function createTelegramAcpReasoningTerminalArbiter() {
	let owner;
	const claim = (candidate) => {
		if (owner === void 0) owner = candidate;
		return owner === candidate;
	};
	return {
		claimNormal: () => claim("normal"),
		claimTimeout: () => claim("timeout"),
		owner: () => owner
	};
}
async function settleTelegramAcpReasoningTimeoutOperation(operation, timeoutMs) {
	if (!(typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0)) return { status: "timed-out" };
	let timer;
	try {
		return await Promise.race([
			Promise.resolve().then(operation).then((value) => ({
				status: "fulfilled",
				value
			}), (error) => ({
				status: "rejected",
				error
			})),
			new Promise((resolve) => {
				timer = setTimeout(() => resolve({ status: "timed-out" }), timeoutMs);
			})
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}
async function finalizeTelegramAcpReasoningTimeoutPresentation(params) {
	const finalizeBudgetMs = typeof params.timeoutMs === "number" && Number.isFinite(params.timeoutMs) && params.timeoutMs > 0 ? Math.floor(params.timeoutMs) : TELEGRAM_ACP_REASONING_TIMEOUT_FINALIZE_BUDGET_MS;
	const discardBudgetMs = typeof params.discardTimeoutMs === "number" && Number.isFinite(params.discardTimeoutMs) && params.discardTimeoutMs > 0 ? Math.floor(params.discardTimeoutMs) : TELEGRAM_ACP_REASONING_TIMEOUT_DISCARD_BUDGET_MS;
	const deadlineAt = Date.now() + finalizeBudgetMs;
	const runOperation = (operation, budgetMs = Number.POSITIVE_INFINITY) => settleTelegramAcpReasoningTimeoutOperation(operation, Math.min(Math.max(0, deadlineAt - Date.now()), budgetMs));
	const activeMessageIds = [];
	const captureActiveMessageId = () => {
		try {
			activeMessageIds.push(params.getActiveMessageId?.());
		} catch (error) {
			params.log?.(`timeout reasoning active message lookup failed: ${String(error)}`);
		}
	};
	captureActiveMessageId();
	const discardSettlement = Promise.resolve().then(() => params.discard?.());
	const discardOutcome = await runOperation(() => discardSettlement, discardBudgetMs);
	const lateSettlements = [];
	if (discardOutcome.status === "timed-out") lateSettlements.push({
		kind: "stream",
		settlement: discardSettlement
	});
	if (discardOutcome.status === "rejected") params.log?.(`timeout reasoning stream discard failed: ${String(discardOutcome.error)}`);
	else if (discardOutcome.status === "timed-out") params.log?.(`timeout reasoning stream discard exceeded ${discardBudgetMs}ms; continuing with notice commit`);
	captureActiveMessageId();
	const messageIds = [...new Set([
		...(params.messageIds ?? []),
		...activeMessageIds,
		params.retainedNoticeMessageId
	].filter((messageId) => typeof messageId === "number" && Number.isFinite(messageId)).map((messageId) => Math.trunc(messageId)))].sort((left, right) => left - right);
	let primaryMessageId = typeof params.retainedNoticeMessageId === "number" && Number.isFinite(params.retainedNoticeMessageId) ? Math.trunc(params.retainedNoticeMessageId) : void 0;
	let noticeCommitted = params.noticeAlreadyCommitted === true;
	let mode = noticeCommitted ? primaryMessageId === void 0 ? "send" : "edit" : "none";
	let cleanupAuthorized = noticeCommitted && primaryMessageId === void 0;
	let noticeCommitAmbiguous = false;
	if (noticeCommitted && primaryMessageId !== void 0) {
		const reassertMessageId = primaryMessageId;
		const reassertSettlement = Promise.resolve().then(() => params.editMessage(reassertMessageId, params.noticeText));
		const reassertOutcome = await runOperation(() => reassertSettlement);
		if (reassertOutcome.status === "fulfilled") cleanupAuthorized = true;
		else if (reassertOutcome.status === "timed-out") {
			noticeCommitAmbiguous = true;
			lateSettlements.push({
				kind: "commit",
				settlement: reassertSettlement.then(() => ({
					noticeCommitted: true,
					mode: "edit",
					primaryMessageId: reassertMessageId
				}), () => ({ noticeCommitted: false }))
			});
			params.log?.(`timeout reasoning notice reassert timed out (${reassertMessageId})`);
		} else {
			params.log?.(`timeout reasoning notice reassert failed (${primaryMessageId}): ${String(reassertOutcome.error)}`);
			noticeCommitted = false;
			mode = "none";
			primaryMessageId = void 0;
		}
	}
	if (!noticeCommitted && !noticeCommitAmbiguous) {
		for (const messageId of messageIds) try {
			const editSettlement = Promise.resolve().then(() => params.editMessage(messageId, params.noticeText));
			const editOutcome = await runOperation(() => editSettlement);
			if (editOutcome.status === "fulfilled") {
				primaryMessageId = messageId;
				noticeCommitted = true;
				cleanupAuthorized = true;
				mode = "edit";
				break;
			}
			if (editOutcome.status === "timed-out") {
				noticeCommitAmbiguous = true;
				primaryMessageId = messageId;
				lateSettlements.push({
					kind: "commit",
					settlement: editSettlement.then(() => ({
						noticeCommitted: true,
						mode: "edit",
						primaryMessageId: messageId
					}), () => ({ noticeCommitted: false }))
				});
				params.log?.(`timeout reasoning notice edit timed out (${messageId})`);
				break;
			}
			params.log?.(`timeout reasoning notice edit failed (${messageId}): ${String(editOutcome.error)}`);
		} catch (error) {
			params.log?.(`timeout reasoning notice edit orchestration failed (${messageId}): ${String(error)}`);
		}
		if (!noticeCommitted && !noticeCommitAmbiguous) {
			const sendSettlement = Promise.resolve().then(() => params.sendNotice(params.noticeText));
			const sendOutcome = await runOperation(() => sendSettlement);
			if (sendOutcome.status === "fulfilled") {
				noticeCommitted = sendOutcome.value === true;
				cleanupAuthorized = noticeCommitted;
				if (noticeCommitted) mode = "send";
			} else if (sendOutcome.status === "timed-out") {
				noticeCommitAmbiguous = true;
				lateSettlements.push({
					kind: "commit",
					settlement: sendSettlement.then((delivered) => delivered === true ? {
						noticeCommitted: true,
						mode: "send",
						primaryMessageId: void 0
					} : { noticeCommitted: false }, () => ({ noticeCommitted: false }))
				});
				params.log?.("timeout reasoning notice send timed out");
			}
			else params.log?.(`timeout reasoning notice send failed: ${String(sendOutcome.error)}`);
		}
	}
	let cleanedMessages = 0;
	const cleanupMessageIds = cleanupAuthorized ? mode === "edit" ? messageIds.filter((messageId) => messageId !== primaryMessageId) : mode === "send" ? messageIds : [] : [];
	const cleanupOutcomes = await Promise.all(cleanupMessageIds.map(async (messageId) => ({
		messageId,
		outcome: await runOperation(() => params.deleteMessage(messageId))
	})));
	for (const { messageId, outcome } of cleanupOutcomes) {
		if (outcome.status === "fulfilled" && outcome.value === true) cleanedMessages += 1;
		else if (outcome.status === "timed-out") params.log?.(`timeout reasoning secondary cleanup timed out (${messageId})`);
		else if (outcome.status === "rejected") params.log?.(`timeout reasoning secondary cleanup failed (${messageId}): ${String(outcome.error)}`);
	}
	return {
		noticeCommitted,
		cleanupAuthorized,
		noticeCommitAmbiguous,
		mode,
		primaryMessageId,
		messageIds,
		cleanedMessages,
		lateSettlements
	};
}
function createTelegramAcpReasoningTimeoutCleanupRunner(params) {
	let initialTask;
	let reconciliationChain = Promise.resolve();
	let lastReconciliationOutcome;
	let reconciliationQueued = false;
	let reconciliationPasses = 0;
	let reconciliationLimitLogged = false;
	let draftDrainNeeded = false;
	let draftDrainUsed = false;
	let commitDrainNeeded = false;
	let terminalCommitDrainUsed = false;
	let pendingCommitSettlements = 0;
	const pendingReconciliationOutcomes = [];
	const reconciliationWaiters = [];
	const observedLateSettlements = /* @__PURE__ */ new WeakSet();
	let committed = {
		noticeCommitted: false,
		mode: "none",
		primaryMessageId: void 0
	};
	const rememberCommitted = (outcome) => {
		if (!outcome?.noticeCommitted) return;
		committed = {
			noticeCommitted: true,
			mode: outcome.mode,
			primaryMessageId: outcome.primaryMessageId
		};
	};
	const runPass = async (phase) => {
		try {
			const outcome = await params.finalize({
				phase,
				committed
			});
			rememberCommitted(outcome);
			return outcome;
		} catch (error) {
			params.log?.(`timeout reasoning ${phase} pass failed: ${String(error)}`);
			return {
				...committed,
				messageIds: [],
				cleanedMessages: 0
			};
		}
	};
	const publishReconciliation = (outcome) => {
		const waiter = reconciliationWaiters.shift();
		if (waiter) waiter(outcome);
		else pendingReconciliationOutcomes.push(outcome);
	};
	let registerLateSettlements = () => {};
	const scheduleReconciliation = (trigger) => {
		if (trigger === "draft") draftDrainNeeded = true;
		else if (trigger === "commit") commitDrainNeeded = true;
		if (pendingCommitSettlements > 0) return reconciliationChain;
		const standardPassAvailable = reconciliationPasses < TELEGRAM_ACP_REASONING_TIMEOUT_MAX_RECONCILIATIONS;
		const terminalDraftDrainAvailable = draftDrainNeeded && !draftDrainUsed;
		const terminalCommitDrainAvailable = commitDrainNeeded && !terminalCommitDrainUsed;
		if (!standardPassAvailable && !terminalDraftDrainAvailable && !terminalCommitDrainAvailable) {
			if (!reconciliationLimitLogged) {
				reconciliationLimitLogged = true;
				params.log?.(`timeout reasoning reconciliation limit reached (${TELEGRAM_ACP_REASONING_TIMEOUT_MAX_RECONCILIATIONS})`);
			}
			return reconciliationChain;
		}
		if (reconciliationQueued) return reconciliationChain;
		reconciliationQueued = true;
		reconciliationChain = reconciliationChain.then(async () => {
			reconciliationQueued = false;
			if (pendingCommitSettlements > 0) return lastReconciliationOutcome;
			if (reconciliationPasses < TELEGRAM_ACP_REASONING_TIMEOUT_MAX_RECONCILIATIONS) {
				reconciliationPasses += 1;
				if (draftDrainNeeded) {
					draftDrainNeeded = false;
					draftDrainUsed = true;
				}
				commitDrainNeeded = false;
			} else {
				let reservedDrainClaimed = false;
				if (draftDrainNeeded && !draftDrainUsed) {
					draftDrainNeeded = false;
					draftDrainUsed = true;
					reservedDrainClaimed = true;
				}
				if (commitDrainNeeded && !terminalCommitDrainUsed) {
					commitDrainNeeded = false;
					terminalCommitDrainUsed = true;
					reservedDrainClaimed = true;
				}
				if (!reservedDrainClaimed) return lastReconciliationOutcome;
			}
			const outcome = await runPass("reconcile");
			lastReconciliationOutcome = outcome;
			registerLateSettlements(outcome);
			publishReconciliation(outcome);
			return outcome;
		});
		void reconciliationChain;
		return reconciliationChain;
	};
	registerLateSettlements = (outcome) => {
		for (const candidate of outcome?.lateSettlements ?? []) {
			const kind = candidate?.kind === "commit" ? "commit" : "stream";
			const settlement = candidate?.settlement ?? candidate;
			if (!settlement || typeof settlement.then !== "function" || observedLateSettlements.has(settlement)) continue;
			observedLateSettlements.add(settlement);
			if (kind === "commit") pendingCommitSettlements += 1;
			void Promise.resolve(settlement).then((lateOutcome) => {
				if (kind === "commit") {
					pendingCommitSettlements = Math.max(0, pendingCommitSettlements - 1);
					rememberCommitted(lateOutcome);
				}
				if (pendingCommitSettlements === 0) void scheduleReconciliation(kind === "commit" ? "commit" : "stream");
			}, (error) => {
				if (kind === "commit") {
					pendingCommitSettlements = Math.max(0, pendingCommitSettlements - 1);
				}
				params.log?.(`timeout reasoning late ${kind} settlement failed: ${String(error)}`);
				if (pendingCommitSettlements === 0) void scheduleReconciliation(kind === "commit" ? "commit" : "stream");
			});
		}
	};
	return {
		request: (draftBarrier = Promise.resolve()) => {
			if (initialTask) return initialTask;
			initialTask = Promise.resolve().then(() => runPass("immediate")).then((outcome) => {
				registerLateSettlements(outcome);
				return outcome;
			});
			void initialTask.then(() => Promise.resolve(draftBarrier).then(() => {
				void scheduleReconciliation("draft");
			}, (error) => {
				params.log?.(`timeout reasoning draft barrier failed: ${String(error)}`);
				void scheduleReconciliation("draft");
			}));
			return initialTask;
		},
		initial: () => initialTask,
		reconciliation: () => pendingReconciliationOutcomes.length > 0 ? Promise.resolve(pendingReconciliationOutcomes.shift()) : new Promise((resolve) => reconciliationWaiters.push(resolve)),
		committed: () => ({ ...committed })
	};
}
//#endregion
//#region local-patch: acp-reasoning-normal-final-v3.5
function collectTelegramAcpReasoningPresentationMessageIds(...groups) {
	return [...new Set(groups.flatMap((group) => group == null ? [] : [...group]).filter((messageId) => typeof messageId === "number" && Number.isFinite(messageId)).map((messageId) => Math.trunc(messageId)))].sort((left, right) => left - right);
}
async function prepareTelegramAcpReasoningPresentation(params) {
	const activeMessageIds = [];
	const dynamicMessageIdGroups = [];
	let preDiscardMessageSetAmbiguous = false;
	let postDiscardMessageSetAmbiguous = false;
	const captureActiveMessageId = () => {
		try {
			activeMessageIds.push(params.getActiveMessageId?.());
		} catch (error) {
			params.log?.(`normal-final reasoning active message lookup failed: ${String(error)}`);
		}
	};
	const captureDynamicMessageIds = () => {
		try {
			dynamicMessageIdGroups.push(params.getMessageIds?.());
		} catch (error) {
			params.log?.(`normal-final reasoning message-id snapshot failed: ${String(error)}`);
		}
	};
	const readPhysicalMessageSetAmbiguity = (phase) => {
		try {
			return params.isMessageSetAmbiguous?.() === true;
		} catch (error) {
			params.log?.(`normal-final reasoning ${phase} message-set ambiguity lookup failed: ${String(error)}`);
			return true;
		}
	};
	captureDynamicMessageIds();
	captureActiveMessageId();
	preDiscardMessageSetAmbiguous = readPhysicalMessageSetAmbiguity("pre-discard");
	try {
		await params.discard?.();
	} catch (error) {
		params.log?.(`normal-final reasoning stream discard failed: ${String(error)}`);
	}
	captureActiveMessageId();
	captureDynamicMessageIds();
	postDiscardMessageSetAmbiguous = readPhysicalMessageSetAmbiguity("post-discard");
	if (preDiscardMessageSetAmbiguous && !postDiscardMessageSetAmbiguous) params.log?.("normal-final reasoning pre-discard ambiguity resolved while settling the draft stream");
	const messageIds = collectTelegramAcpReasoningPresentationMessageIds(params.messageIds, ...dynamicMessageIdGroups, activeMessageIds);
	const maskedMessageIds = [];
	if (postDiscardMessageSetAmbiguous) return {
		messageIds,
		maskedMessageIds,
		primaryMessageId: void 0,
		ambiguous: true
	};
	for (const [index, messageId] of messageIds.entries()) try {
		await params.maskMessage(messageId, index, messageIds.length);
		maskedMessageIds.push(messageId);
	} catch (error) {
		params.log?.(`normal-final reasoning pending-message edit failed (${messageId}): ${String(error)}`);
	}
	return {
		messageIds,
		maskedMessageIds,
		primaryMessageId: maskedMessageIds[0],
		ambiguous: false
	};
}
//#endregion

export { createTelegramAcpReasoningTerminalArbiter, settleTelegramAcpReasoningTimeoutOperation, finalizeTelegramAcpReasoningTimeoutPresentation, createTelegramAcpReasoningTimeoutCleanupRunner, collectTelegramAcpReasoningPresentationMessageIds, prepareTelegramAcpReasoningPresentation, isTelegramSpooledHandlerTimeoutAbortReason, TELEGRAM_ACP_REASONING_TIMEOUT_NOTICE };
