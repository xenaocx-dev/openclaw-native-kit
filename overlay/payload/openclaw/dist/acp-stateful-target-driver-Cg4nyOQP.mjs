import { l as resolveAgentIdFromSessionKey, y as isAcpSessionKey } from "./session-key-PQkfotIJ.mjs";
import "./session-accessor-BxcCxteu.mjs";
import { a as resolveSessionEntryAccessTarget } from "./session-accessor.entry-BZwCuwaW.mjs";
import { c as resolveAcpSessionTarget } from "./manager.utils-DVrjhKiP.mjs";
import { n as readAcpSessionEntry } from "./session-meta-a5vM4NJL.mjs";
import { a as resolveConfiguredAcpBindingSpecFromRecord } from "./persistent-bindings.types-ChD0ZkNL.mjs";
import { n as resolveConfiguredAcpBindingSpecBySessionKey } from "./persistent-bindings.resolve-uM4fbnnw.mjs";
import { n as ensureConfiguredAcpBindingSession, t as ensureConfiguredAcpBindingReadyCore } from "./persistent-bindings.lifecycle-C4_IgMUV.mjs";
import { s as performGatewaySessionReset } from "./session-reset-service-CAUbxbvS.mjs";
import { t as getAcpSessionManager } from "./manager-DTkVUGeR.mjs";
//#region src/channels/plugins/acp-stateful-target-driver.ts
/**
* ACP stateful target driver for configured bindings.
*
* Ensures ACP-backed bound sessions exist, are ready, and can be reset by Gateway.
*/
function toAcpStatefulBindingTargetDescriptor(params) {
	const sessionKey = params.sessionKey.trim();
	if (!sessionKey) return null;
	const target = resolveAcpSessionTarget(params);
	if (readAcpSessionEntry({
		cfg: params.cfg,
		...target
	})?.acp) return {
		kind: "stateful",
		driverId: "acp",
		...target
	};
	const spec = resolveConfiguredAcpBindingSpecBySessionKey({
		...params,
		sessionKey
	});
	if (!spec) {
		if (!isAcpSessionKey(sessionKey)) return null;
		return {
			kind: "stateful",
			driverId: "acp",
			sessionKey,
			agentId: resolveAgentIdFromSessionKey(sessionKey)
		};
	}
	return {
		kind: "stateful",
		driverId: "acp",
		sessionKey,
		agentId: spec.agentId,
		...spec.label ? { label: spec.label } : {}
	};
}
async function ensureAcpTargetReady(params) {
	const configuredBinding = resolveConfiguredAcpBindingSpecFromRecord(params.bindingResolution.record);
	if (!configuredBinding) return {
		ok: false,
		error: "Configured ACP binding unavailable"
	};
	return await ensureConfiguredAcpBindingReadyCore({
		cfg: params.cfg,
		configuredBinding: {
			spec: configuredBinding,
			record: params.bindingResolution.record
		}
	});
}
async function ensureAcpTargetSession(params) {
	const spec = resolveConfiguredAcpBindingSpecFromRecord(params.bindingResolution.record);
	if (!spec) return {
		ok: false,
		sessionKey: params.bindingResolution.statefulTarget.sessionKey,
		error: "Configured ACP binding unavailable"
	};
	return await ensureConfiguredAcpBindingSession({
		cfg: params.cfg,
		spec
	});
}
async function resetAcpTargetInPlace(params) {
	if (resolveSessionEntryAccessTarget({
		cfg: params.cfg,
		sessionKey: params.sessionKey,
		agentId: params.bindingTarget.agentId
	}).entry?.incognito === true) return {
		ok: false,
		error: "Incognito sessions cannot reset in place."
	};
	const acpManager = getAcpSessionManager();
	const previousMeta = readAcpSessionEntry({
		cfg: params.cfg,
		sessionKey: params.sessionKey,
		agentId: params.bindingTarget.agentId,
		allowStaleLifecycleRevision: true
	})?.acp;
	const previousAcpSessionId = previousMeta?.identity?.acpxSessionId ?? previousMeta?.identity?.agentSessionId;
	const result = await performGatewaySessionReset({
		key: params.sessionKey,
		agentId: params.bindingTarget.agentId,
		operatorRoleActor: { kind: "system" },
		reason: params.reason,
		commandSource: params.commandSource ?? "stateful-target:acp-reset-in-place",
		armSessionDiffBaselineCapture: true,
		preserveConversationBindings: true
	});
	if (result.ok) {
		if ("incognitoDeleted" in result) return {
			ok: true,
			sessionKey: result.key,
			storePath: result.storePath
		};
		try {
			const freshStatus = await acpManager.getSessionStatus({
				cfg: params.cfg,
				sessionKey: result.key,
				agentId: params.bindingTarget.agentId
			});
			const freshAcpSessionId = freshStatus.identity?.acpxSessionId ?? freshStatus.identity?.agentSessionId;
			if (!freshAcpSessionId) return {
				ok: false,
				error: "ACP session reset completed, but the fresh runtime did not advertise a session id"
			};
			if (previousAcpSessionId && freshAcpSessionId === previousAcpSessionId) return {
				ok: false,
				error: "ACP session reset completed, but the runtime reused the previous session id"
			};
		} catch (error) {
			return {
				ok: false,
				error: `ACP session reset completed, but fresh runtime initialization failed: ${String(error)}`
			};
		}
		return {
			ok: true,
			sessionKey: result.key,
			sessionId: result.entry.sessionId,
			storePath: result.storePath
		};
	}
	return {
		ok: false,
		error: result.error.message
	};
}
const acpStatefulBindingTargetDriver = {
	id: "acp",
	ensureReady: ensureAcpTargetReady,
	ensureSession: ensureAcpTargetSession,
	resolveTargetBySessionKey: toAcpStatefulBindingTargetDescriptor,
	resetInPlace: resetAcpTargetInPlace
};
//#endregion
export { acpStatefulBindingTargetDriver };
