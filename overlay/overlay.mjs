#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const overlayRoot = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(overlayRoot, "manifest.json"), "utf8"));

function sha256(buffer) {
	return crypto.createHash("sha256").update(buffer).digest("hex");
}

function fileSha(filePath) {
	return sha256(fs.readFileSync(filePath));
}

function safeTarget(root, relativePath) {
	const resolvedRoot = path.resolve(root);
	const target = path.resolve(resolvedRoot, relativePath);
	if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`target escapes root: ${relativePath}`);
	return target;
}

function readVersion(root) {
	return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
}

function findAdapterRoot(acpxRoot) {
	let cursor = path.resolve(acpxRoot);
	for (let depth = 0; depth < 10; depth += 1) {
		if (path.basename(cursor) === "node_modules") {
			const candidate = path.join(cursor, "@agentclientprotocol", "claude-agent-acp");
			if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
		}
		const parent = path.dirname(cursor);
		if (parent === cursor) break;
		cursor = parent;
	}
	throw new Error("could not locate @agentclientprotocol/claude-agent-acp beside the acpx installation; pass --adapter-root");
}

function resolveRoots(options) {
	const openclaw = path.resolve(options.openclawRoot);
	const acpx = path.resolve(options.acpxRoot);
	const adapter = path.resolve(options.adapterRoot ?? findAdapterRoot(acpx));
	const state = path.resolve(options.stateDir);
	return { openclaw, acpx, adapter, state };
}

function verifyVersions(roots) {
	const actual = {
		openclaw: readVersion(roots.openclaw),
		acpx: readVersion(roots.acpx),
		claudeAgentAcp: readVersion(roots.adapter)
	};
	for (const [name, expected] of Object.entries(manifest.versions)) {
		if (actual[name] !== expected) throw new Error(`${name} version mismatch: expected ${expected}, got ${actual[name]}`);
	}
	return actual;
}

function inspectTarget(spec, roots) {
	const payloadPath = safeTarget(path.join(overlayRoot, "payload"), spec.payload);
	const payloadSha = fileSha(payloadPath);
	if (payloadSha !== spec.sha256) throw new Error(`payload SHA mismatch: ${spec.payload}`);
	const targetPath = safeTarget(roots[spec.root], spec.path);
	if (!fs.existsSync(targetPath)) {
		if (spec.accepts.length > 0 && spec.createIfMissing !== true) return { ...spec, targetPath, payloadPath, status: "missing", actualSha256: null };
		return { ...spec, targetPath, payloadPath, status: "ready-create", actualSha256: null };
	}
	const actualSha256 = fileSha(targetPath);
	if (actualSha256 === spec.sha256) return { ...spec, targetPath, payloadPath, status: "installed", actualSha256 };
	if (spec.accepts.includes(actualSha256)) return { ...spec, targetPath, payloadPath, status: "ready-replace", actualSha256 };
	return { ...spec, targetPath, payloadPath, status: "drift", actualSha256 };
}

export function inspectOverlay(options) {
	const roots = resolveRoots(options);
	const versions = verifyVersions(roots);
	const targets = manifest.targets.map((spec) => inspectTarget(spec, roots));
	const blocked = targets.filter((entry) => entry.status === "drift" || entry.status === "missing");
	return { roots, versions, targets, blocked };
}

function timestampSlug() {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

export function applyOverlay(options) {
	const inspection = inspectOverlay(options);
	if (inspection.blocked.length > 0) {
		const detail = inspection.blocked.map((entry) => `${entry.root}:${entry.path}=${entry.status}:${entry.actualSha256 ?? "absent"}`).join(", ");
		throw new Error(`overlay preflight refused: ${detail}`);
	}
	const pending = inspection.targets.filter((entry) => entry.status !== "installed");
	if (pending.length === 0) return { status: "already-installed", changed: 0, backupDir: null, inspection };

	const backupDir = path.join(inspection.roots.state, "patch-backups", manifest.id, timestampSlug());
	fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
	const journalPath = path.join(backupDir, "deployment.json");
	const journal = {
		id: manifest.id,
		status: "prepared",
		createdAt: new Date().toISOString(),
		versions: inspection.versions,
		entries: []
	};

	for (const entry of pending) {
		const backupPath = safeTarget(path.join(backupDir, entry.root), entry.path);
		const existed = fs.existsSync(entry.targetPath);
		if (existed) {
			fs.mkdirSync(path.dirname(backupPath), { recursive: true, mode: 0o700 });
			fs.copyFileSync(entry.targetPath, backupPath);
		}
		journal.entries.push({
			root: entry.root,
			path: entry.path,
			existed,
			beforeSha256: entry.actualSha256,
			afterSha256: entry.sha256
		});
	}
	fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });

	const staged = [];
	const installed = [];
	try {
		for (const entry of pending) {
			fs.mkdirSync(path.dirname(entry.targetPath), { recursive: true });
			const tempPath = path.join(path.dirname(entry.targetPath), `.${path.basename(entry.targetPath)}.overlay-${process.pid}`);
			fs.copyFileSync(entry.payloadPath, tempPath);
			const mode = fs.existsSync(entry.targetPath) ? fs.statSync(entry.targetPath).mode & 0o777 : entry.mode ?? 0o644;
			fs.chmodSync(tempPath, mode);
			staged.push({ entry, tempPath });
		}
		for (const item of staged) {
			fs.renameSync(item.tempPath, item.entry.targetPath);
			installed.push(item.entry);
		}
		for (const entry of pending) {
			if (fileSha(entry.targetPath) !== entry.sha256) throw new Error(`post-write SHA mismatch: ${entry.root}:${entry.path}`);
		}
		journal.status = "installed";
		journal.completedAt = new Date().toISOString();
		fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });
	} catch (error) {
		for (const item of staged) if (fs.existsSync(item.tempPath)) fs.rmSync(item.tempPath, { force: true });
		for (const entry of installed.reverse()) {
			const record = journal.entries.find((candidate) => candidate.root === entry.root && candidate.path === entry.path);
			if (record?.existed) {
				const backupPath = safeTarget(path.join(backupDir, entry.root), entry.path);
				fs.copyFileSync(backupPath, entry.targetPath);
			} else fs.rmSync(entry.targetPath, { force: true });
		}
		journal.status = "rolled-back";
		journal.error = String(error);
		fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });
		throw error;
	}
	return { status: "installed", changed: pending.length, backupDir, inspection: inspectOverlay(options) };
}

function parseCli(argv) {
	const command = argv[2];
	if (command !== "verify" && command !== "apply") throw new Error("usage: overlay.mjs <verify|apply> --openclaw-root PATH --acpx-root PATH --state-dir PATH [--adapter-root PATH]");
	const values = {};
	for (let index = 3; index < argv.length; index += 2) {
		const key = argv[index];
		const value = argv[index + 1];
		if (!key?.startsWith("--") || value === undefined) throw new Error(`invalid argument near ${key ?? "end"}`);
		values[key.slice(2)] = value;
	}
	for (const required of ["openclaw-root", "acpx-root", "state-dir"]) if (!values[required]) throw new Error(`missing --${required}`);
	return {
		command,
		options: {
			openclawRoot: values["openclaw-root"],
			acpxRoot: values["acpx-root"],
			stateDir: values["state-dir"],
			...(values["adapter-root"] ? { adapterRoot: values["adapter-root"] } : {})
		}
	};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		const { command, options } = parseCli(process.argv);
		const result = command === "verify" ? inspectOverlay(options) : applyOverlay(options);
		console.log(JSON.stringify({
			id: manifest.id,
			command,
			roots: (result.inspection ?? result).roots,
			status: result.status ?? (result.blocked.length === 0 ? "ready" : "blocked"),
			changed: result.changed ?? 0,
			backupDir: result.backupDir ?? null,
			counts: Object.fromEntries(Object.entries((result.inspection ?? result).targets.reduce((counts, entry) => {
				counts[entry.status] = (counts[entry.status] ?? 0) + 1;
				return counts;
			}, {})))
		}, null, 2));
	} catch (error) {
		console.error(String(error));
		process.exitCode = 1;
	}
}
