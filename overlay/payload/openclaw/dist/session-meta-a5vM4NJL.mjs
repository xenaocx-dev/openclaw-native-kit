import "./src-DqBJ2aW2.mjs";
import { n as safeParseJsonRecord } from "./json-coercion-C7YSvZ9t.mjs";
import { o as normalizeLowercaseStringOrEmpty } from "./string-coerce-CIXf7egm.mjs";
import { n as executeSqliteQuerySync } from "./kysely-sync-CrjZjQJR.mjs";
import { o as withExistingOpenClawStateDatabaseReadOnly } from "./openclaw-state-db-readonly-Drry1uVZ.mjs";
import { s as runOpenClawStateWriteTransaction } from "./openclaw-state-db-DoQEJuhr.mjs";
import { n as getRuntimeConfig } from "./io.runtime-Bm3fPzNt.mjs";
import "./config-Cy-qhyji.mjs";
import { a as buildAcpDatabaseSessionKey, c as parseAcpDatabaseSessionKeyCandidates, d as selectAcpSessionRowForStoreEntry, i as acpSessionRowMatchesEntry, l as resolveReadableAcpSessionRow, n as resolveSessionStorePathForAcp, o as getAcpSessionKysely, r as resolveStoreEntryForSessionKey, s as legacyAcpDatabaseSessionKeys, t as readSessionEntryFromStore, u as selectAcpSessionRow } from "./session-meta-store-DNEj-6jn.mjs";
import { r as mergeSessionEntry } from "./types-DTKXAkwv.mjs";
import "./session-accessor-BxcCxteu.mjs";
import { r as patchSessionEntryWithKey } from "./session-accessor.entry-BZwCuwaW.mjs";
//#region src/acp/runtime/session-meta-legacy-cleanup.ts
async function clearLegacyEmbeddedAcpMetadata(params) {
	const sessionKeys = new Set(Array.from(params.sessionKeys, (sessionKey) => sessionKey?.trim()).filter((sessionKey) => Boolean(sessionKey)));
	for (const sessionKey of sessionKeys) await patchSessionEntryWithKey({
		storePath: params.storePath,
		agentId: params.agentId,
		sessionKey
	}, (entry) => {
		if (!entry.acp) return null;
		const next = { ...entry };
		delete next.acp;
		return next;
	}, {
		replaceEntry: true,
		skipMaintenance: true
	});
}
//#endregion
//#region src/acp/runtime/session-meta.ts
function rowToAcpSessionMeta(row) {
	const identity = safeParseJsonRecord(row.identity_json ?? "");
	const runtimeOptions = safeParseJsonRecord(row.runtime_options_json ?? "");
	return {
		backend: row.backend,
		agent: row.agent,
		runtimeSessionName: row.runtime_session_name,
		...identity ? { identity } : {},
		mode: row.mode === "oneshot" ? "oneshot" : "persistent",
		...runtimeOptions ? { runtimeOptions } : {},
		...row.cwd != null ? { cwd: row.cwd } : {},
		state: row.state === "running" || row.state === "error" ? row.state : "idle",
		lastActivityAt: row.last_activity_at,
		...row.last_error != null ? { lastError: row.last_error } : {}
	};
}
function bindAcpSessionMeta(params) {
	return {
		session_key: params.sessionKey,
		session_id: params.lifecycleRevision ?? params.sessionId ?? null,
		backend: params.meta.backend,
		agent: params.meta.agent,
		runtime_session_name: params.meta.runtimeSessionName,
		identity_json: params.meta.identity ? JSON.stringify(params.meta.identity) : null,
		mode: params.meta.mode,
		runtime_options_json: params.meta.runtimeOptions ? JSON.stringify(params.meta.runtimeOptions) : null,
		cwd: params.meta.cwd ?? null,
		state: params.meta.state,
		last_activity_at: params.meta.lastActivityAt,
		last_error: params.meta.lastError ?? null,
		updated_at: params.updatedAt
	};
}
function selectAcpSessionRowForStoreEntryForRead(db, storeEntry, allowStaleLifecycleRevision) {
	if (allowStaleLifecycleRevision === true) {
		const databaseKey = buildAcpDatabaseSessionKey(storeEntry.storeSessionKey, storeEntry.agentId);
		for (const key of [databaseKey, ...legacyAcpDatabaseSessionKeys(storeEntry.storeSessionKey, storeEntry.agentId, storeEntry.cfg)]) {
			const row = selectAcpSessionRow(db, key);
			if (row) return row;
		}
		return;
	}
	return resolveReadableAcpSessionRow({
		row: selectAcpSessionRowForStoreEntry(db, storeEntry.storeSessionKey, storeEntry.agentId, storeEntry.cfg, storeEntry.entry),
		entry: storeEntry.entry
	});
}
function readAcpSessionMeta(params) {
	const sessionKey = params.sessionKey.trim();
	if (!sessionKey) return;
	const storeEntry = readSessionEntryFromStore({
		sessionKey,
		agentId: params.agentId,
		cfg: params.cfg,
		env: params.env,
		clone: false
	});
	if (!storeEntry.storePath) return;
	const row = withExistingOpenClawStateDatabaseReadOnly(({ db }) => selectAcpSessionRowForStoreEntryForRead(db, storeEntry, params.allowStaleLifecycleRevision), {
		env: params.env,
		path: params.databasePath
	});
	if (!row) return;
	return rowToAcpSessionMeta(row);
}
function readAcpSessionMetaForEntry(params) {
	const sessionKey = params.sessionKey.trim();
	if (!sessionKey) return;
	const row = withExistingOpenClawStateDatabaseReadOnly(({ db }) => resolveReadableAcpSessionRow({
		row: selectAcpSessionRowForStoreEntry(db, sessionKey, params.agentId, params.cfg, params.entry),
		entry: params.entry
	}), {
		env: params.env,
		path: params.databasePath
	});
	if (!row) return;
	return rowToAcpSessionMeta(row);
}
function readAcpSessionMetaBatch(params) {
	const result = /* @__PURE__ */ new Map();
	const entriesByKey = /* @__PURE__ */ new Map();
	for (const item of params.entries) {
		const rawSessionKey = item.sessionKey.trim();
		const sessionKey = buildAcpDatabaseSessionKey(rawSessionKey, item.agentId);
		if (!sessionKey) continue;
		if (item.entry?.acp) {
			result.set(item.entry, item.entry.acp);
			continue;
		}
		const legacyKeys = legacyAcpDatabaseSessionKeys(rawSessionKey, item.agentId, params.cfg);
		const entries = entriesByKey.get(sessionKey) ?? [];
		entries.push({
			entry: item.entry,
			rawSessionKey,
			legacyKeys
		});
		entriesByKey.set(sessionKey, entries);
	}
	if (entriesByKey.size === 0) return result;
	withExistingOpenClawStateDatabaseReadOnly(({ db: database }) => {
		const db = getAcpSessionKysely(database);
		const requestedKeySet = /* @__PURE__ */ new Set();
		for (const [sessionKey, entries] of entriesByKey) {
			requestedKeySet.add(sessionKey);
			for (const item of entries) for (const legacyKey of item.legacyKeys) requestedKeySet.add(legacyKey);
		}
		const requestedKeys = [...requestedKeySet];
		const keyChunks = [];
		for (let index = 0; index < requestedKeys.length; index += 500) keyChunks.push(requestedKeys.slice(index, index + 500));
		const rows = keyChunks.flatMap((chunk) => executeSqliteQuerySync(database, db.selectFrom("acp_sessions").selectAll().where("session_key", "in", chunk)).rows);
		const rowsByKey = new Map(rows.map((row) => [row.session_key, row]));
		for (const [sessionKey, entries] of entriesByKey) for (const item of entries) {
			const row = [sessionKey, ...item.legacyKeys].map((key) => rowsByKey.get(key)).map((candidateRow) => resolveReadableAcpSessionRow({
				row: candidateRow,
				entry: item.entry
			})).find((candidateRow) => candidateRow !== void 0);
			result.set(item.entry, row ? rowToAcpSessionMeta(row) : void 0);
		}
	}, {
		env: params.env,
		path: params.databasePath
	});
	return result;
}
function selectAcpSessionRows(options = {}) {
	return withExistingOpenClawStateDatabaseReadOnly(({ db }) => executeSqliteQuerySync(db, getAcpSessionKysely(db).selectFrom("acp_sessions").selectAll().orderBy("last_activity_at", "desc").orderBy("session_key", "asc")).rows, options) ?? [];
}
function writeAcpSessionMetaForMigration(params) {
	const sessionKey = params.sessionKey.trim();
	if (!sessionKey) return;
	const row = bindAcpSessionMeta({
		sessionKey,
		sessionId: params.sessionId,
		lifecycleRevision: params.lifecycleRevision,
		meta: params.meta,
		updatedAt: params.now?.() ?? Date.now()
	});
	runOpenClawStateWriteTransaction((database) => {
		upsertAcpSessionMetaRow(database.db, row);
	}, {
		env: params.env,
		path: params.databasePath
	});
}
function repairAcpSessionMetaKeyForMigration(params) {
	const sessionKey = params.sessionKey.trim();
	if (!sessionKey) return false;
	let repaired = false;
	runOpenClawStateWriteTransaction((database) => {
		const currentRow = selectAcpSessionRow(database.db, sessionKey);
		if (currentRow && acpSessionRowMatchesEntry(currentRow, params.entry)) return;
		const normalizedSessionKey = normalizeLowercaseStringOrEmpty(sessionKey);
		const candidateKeys = /* @__PURE__ */ new Set();
		candidateKeys.add(normalizedSessionKey);
		for (const candidate of params.candidateSessionKeys ?? []) {
			const trimmed = typeof candidate === "string" ? candidate.trim() : "";
			if (trimmed && trimmed !== sessionKey && normalizeLowercaseStringOrEmpty(trimmed) === normalizedSessionKey) candidateKeys.add(trimmed);
		}
		let row;
		for (const candidateKey of candidateKeys) {
			const candidateRow = selectAcpSessionRow(database.db, candidateKey);
			if (candidateRow && acpSessionRowMatchesEntry(candidateRow, params.entry)) {
				row = candidateRow;
				break;
			}
		}
		row ??= executeSqliteQuerySync(database.db, getAcpSessionKysely(database.db).selectFrom("acp_sessions").selectAll().where((eb) => eb.fn("lower", ["session_key"]), "=", normalizedSessionKey).orderBy("last_activity_at", "desc").orderBy("session_key", "asc")).rows.find((candidate) => candidate.session_key !== sessionKey && acpSessionRowMatchesEntry(candidate, params.entry));
		if (!row) return;
		upsertAcpSessionMetaRow(database.db, {
			...row,
			session_key: sessionKey,
			updated_at: params.now?.() ?? Date.now()
		});
		executeSqliteQuerySync(database.db, getAcpSessionKysely(database.db).deleteFrom("acp_sessions").where("session_key", "=", row.session_key));
		repaired = true;
	}, {
		env: params.env,
		path: params.databasePath
	});
	return repaired;
}
function upsertAcpSessionMetaRow(db, row) {
	executeSqliteQuerySync(db, getAcpSessionKysely(db).insertInto("acp_sessions").values(row).onConflict((conflict) => conflict.column("session_key").doUpdateSet({
		session_id: (eb) => eb.ref("excluded.session_id"),
		backend: (eb) => eb.ref("excluded.backend"),
		agent: (eb) => eb.ref("excluded.agent"),
		runtime_session_name: (eb) => eb.ref("excluded.runtime_session_name"),
		identity_json: (eb) => eb.ref("excluded.identity_json"),
		mode: (eb) => eb.ref("excluded.mode"),
		runtime_options_json: (eb) => eb.ref("excluded.runtime_options_json"),
		cwd: (eb) => eb.ref("excluded.cwd"),
		state: (eb) => eb.ref("excluded.state"),
		last_activity_at: (eb) => eb.ref("excluded.last_activity_at"),
		last_error: (eb) => eb.ref("excluded.last_error"),
		updated_at: (eb) => eb.ref("excluded.updated_at")
	})));
}
function readAcpSessionEntry(params) {
	const sessionKey = params.sessionKey.trim();
	if (!sessionKey) return null;
	const storeEntry = readSessionEntryFromStore(params);
	if (!storeEntry.storePath) return null;
	const row = withExistingOpenClawStateDatabaseReadOnly(({ db }) => selectAcpSessionRowForStoreEntryForRead(db, storeEntry, params.allowStaleLifecycleRevision), {
		env: params.env,
		path: params.databasePath
	});
	const acp = row ? rowToAcpSessionMeta(row) : void 0;
	return {
		cfg: storeEntry.cfg,
		agentId: storeEntry.agentId,
		storePath: storeEntry.storePath,
		sessionKey,
		storeSessionKey: storeEntry.storeSessionKey,
		entry: storeEntry.entry,
		acp,
		storeReadFailed: storeEntry.storeReadFailed
	};
}
async function listAcpSessionEntries(params) {
	const cfg = params.cfg ?? getRuntimeConfig();
	const rows = selectAcpSessionRows({
		env: params.env,
		path: params.databasePath
	});
	const entries = [];
	for (const row of rows) for (const databaseIdentity of parseAcpDatabaseSessionKeyCandidates(row.session_key)) {
		const sessionKey = databaseIdentity.storeSessionKey;
		const { agentId, storePath } = resolveSessionStorePathForAcp({
			sessionKey,
			agentId: databaseIdentity.agentId,
			cfg,
			env: params.env
		});
		if (!storePath) continue;
		let storeSessionKey;
		let entry;
		try {
			({storeSessionKey, entry} = resolveStoreEntryForSessionKey({
				...agentId ? { agentId } : {},
				storePath,
				sessionKey,
				...params.clone === false ? { clone: false } : {}
			}));
		} catch {
			continue;
		}
		const readableRow = resolveReadableAcpSessionRow({
			row,
			entry
		});
		if (!entry || !readableRow) continue;
		entries.push({
			cfg,
			agentId,
			storePath,
			sessionKey,
			storeSessionKey,
			entry,
			acp: rowToAcpSessionMeta(readableRow)
		});
		break;
	}
	return entries;
}
function mergeAcpForReturn(entry, acp) {
	return mergeSessionEntry(entry, { acp });
}
function sessionStoreUpdateOptions(params) {
	return {
		activeSessionKey: normalizeLowercaseStringOrEmpty(params.sessionKey),
		...params.skipMaintenance === true ? { skipMaintenance: true } : {},
		...params.takeCacheOwnership === true ? { takeCacheOwnership: true } : {}
	};
}
async function upsertAcpSessionMeta(params) {
	const sessionKey = params.sessionKey.trim();
	if (!sessionKey) return null;
	const storeEntry = readSessionEntryFromStore({
		sessionKey,
		agentId: params.agentId,
		cfg: params.cfg,
		env: params.env,
		clone: false
	});
	if (!storeEntry.storePath) return null;
	const { entry } = storeEntry;
	const storageSessionKey = storeEntry.storeSessionKey;
	const databaseSessionKey = buildAcpDatabaseSessionKey(storageSessionKey, storeEntry.agentId);
	let current;
	let currentRowKey;
	let nextMeta;
	let preparedEntry;
	const updatedAt = params.now?.() ?? Date.now();
	runOpenClawStateWriteTransaction((database) => {
		const currentRow = selectAcpSessionRowForStoreEntry(database.db, storageSessionKey, storeEntry.agentId, storeEntry.cfg, entry);
		currentRowKey = currentRow?.session_key;
		current = currentRow ? rowToAcpSessionMeta(currentRow) : void 0;
		preparedEntry = mergeSessionEntry(entry, { updatedAt });
		nextMeta = params.mutate(current, current ? mergeAcpForReturn(preparedEntry, current) : entry);
	}, {
		env: params.env,
		path: params.databasePath
	});
	const metaToPersist = nextMeta;
	if (metaToPersist === void 0) return current ? mergeAcpForReturn(entry, current) : entry ?? null;
	if (metaToPersist === null) {
		const patched = entry ? await patchSessionEntryWithKey({
			...storeEntry.agentId ? { agentId: storeEntry.agentId } : {},
			storePath: storeEntry.storePath,
			sessionKey: storageSessionKey
		}, (currentEntry) => {
			const next = { ...currentEntry };
			delete next.acp;
			return next;
		}, {
			...sessionStoreUpdateOptions({
				...params,
				sessionKey: storageSessionKey
			}),
			replaceEntry: true,
			assertCommitAllowed: params.assertCommitAllowed
		}) : null;
		runOpenClawStateWriteTransaction((database) => {
			params.assertCommitAllowed?.();
			const sessionKeysToDelete = /* @__PURE__ */ new Set([databaseSessionKey]);
			if (currentRowKey) sessionKeysToDelete.add(currentRowKey);
			if (patched?.sessionKey) sessionKeysToDelete.add(buildAcpDatabaseSessionKey(patched.sessionKey, storeEntry.agentId));
			for (const key of sessionKeysToDelete) executeSqliteQuerySync(database.db, getAcpSessionKysely(database.db).deleteFrom("acp_sessions").where("session_key", "=", key));
		}, {
			env: params.env,
			path: params.databasePath
		});
		await clearLegacyEmbeddedAcpMetadata({
			agentId: storeEntry.agentId,
			storePath: storeEntry.storePath,
			sessionKeys: [storageSessionKey, patched?.sessionKey]
		});
		return patched?.entry ?? null;
	}
	const persisted = await patchSessionEntryWithKey({
		...storeEntry.agentId ? { agentId: storeEntry.agentId } : {},
		storePath: storeEntry.storePath,
		sessionKey: storageSessionKey
	}, (currentEntry) => {
		const next = mergeSessionEntry(currentEntry, { updatedAt });
		delete next.acp;
		return next;
	}, {
		...sessionStoreUpdateOptions({
			...params,
			sessionKey: storageSessionKey
		}),
		fallbackEntry: preparedEntry,
		replaceEntry: true,
		assertCommitAllowed: params.assertCommitAllowed
	});
	if (!persisted) return null;
	await clearLegacyEmbeddedAcpMetadata({
		agentId: storeEntry.agentId,
		storePath: storeEntry.storePath,
		sessionKeys: [storageSessionKey, persisted.sessionKey]
	});
	runOpenClawStateWriteTransaction((database) => {
		params.assertCommitAllowed?.();
		const persistedDatabaseSessionKey = buildAcpDatabaseSessionKey(persisted.sessionKey, storeEntry.agentId);
		upsertAcpSessionMetaRow(database.db, bindAcpSessionMeta({
			sessionKey: persistedDatabaseSessionKey,
			sessionId: persisted.entry.sessionId,
			lifecycleRevision: persisted.entry.lifecycleRevision,
			meta: metaToPersist,
			updatedAt: persisted.entry.updatedAt
		}));
		if (persistedDatabaseSessionKey !== databaseSessionKey) executeSqliteQuerySync(database.db, getAcpSessionKysely(database.db).deleteFrom("acp_sessions").where("session_key", "=", databaseSessionKey));
		if (currentRowKey && currentRowKey !== persistedDatabaseSessionKey) executeSqliteQuerySync(database.db, getAcpSessionKysely(database.db).deleteFrom("acp_sessions").where("session_key", "=", currentRowKey));
		if (persistedDatabaseSessionKey !== persisted.sessionKey) {
			const legacyRow = selectAcpSessionRow(database.db, persisted.sessionKey);
			if (legacyRow && acpSessionRowMatchesEntry(legacyRow, persisted.entry)) executeSqliteQuerySync(database.db, getAcpSessionKysely(database.db).deleteFrom("acp_sessions").where("session_key", "=", persisted.sessionKey));
		}
	}, {
		env: params.env,
		path: params.databasePath
	});
	return mergeAcpForReturn(persisted.entry, metaToPersist);
}
//#endregion
export { readAcpSessionMetaForEntry as a, upsertAcpSessionMeta as c, readAcpSessionMetaBatch as i, writeAcpSessionMetaForMigration as l, readAcpSessionEntry as n, repairAcpSessionMetaKeyForMigration as o, readAcpSessionMeta as r, rowToAcpSessionMeta as s, listAcpSessionEntries as t };
