import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { applyOverlay, inspectOverlay } from "../overlay.mjs";

const overlayRoot = path.resolve(import.meta.dirname, "..");
const fixtureRoot = path.join(import.meta.dirname, "fixtures");
const manifest = JSON.parse(fs.readFileSync(path.join(overlayRoot, "manifest.json"), "utf8"));
const sourceRoots = Object.fromEntries(["openclaw", "acpx", "adapter", "state"].map(key => [key, path.join(fixtureRoot, key)]));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-overlay-"));
const roots = {
	openclaw: path.join(tempRoot, "openclaw"),
	acpx: path.join(tempRoot, "node_modules/@openclaw/acpx"),
	adapter: path.join(tempRoot, "node_modules/@agentclientprotocol/claude-agent-acp"),
	state: path.join(tempRoot, "state")
};
const options = { openclawRoot: roots.openclaw, acpxRoot: roots.acpx, stateDir: roots.state };

try {
	for (const entry of JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures.json"), "utf8"))) {
		const bytes = fs.readFileSync(path.resolve(overlayRoot, "..", entry.path));
		assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.path);
	}
	for (const [name, version] of [
		["openclaw", manifest.versions.openclaw],
		["acpx", manifest.versions.acpx],
		["adapter", manifest.versions.claudeAgentAcp]
	]) {
		fs.mkdirSync(roots[name], { recursive: true });
		fs.writeFileSync(path.join(roots[name], "package.json"), `${JSON.stringify({ name, version })}\n`);
	}

	for (const spec of manifest.targets) {
		if (spec.accepts.length === 0 || spec.createIfMissing) continue;
		const source = path.join(sourceRoots[spec.root], spec.path);
		const target = path.join(roots[spec.root], spec.path);
		assert.ok(fs.existsSync(source), `missing source fixture: ${source}`);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.copyFileSync(source, target);
	}

	const before = inspectOverlay(options);
	assert.equal(before.blocked.length, 0);
	assert.ok(before.targets.some((entry) => entry.status === "ready-replace"));
	assert.ok(before.targets.some((entry) => entry.status === "ready-create"));

	const applied = applyOverlay(options);
	assert.equal(applied.status, "installed");
	assert.ok(applied.changed > 0);
	assert.ok(applied.inspection.targets.every((entry) => entry.status === "installed"));
	assert.ok(fs.existsSync(path.join(applied.backupDir, "deployment.json")));
	assert.equal(fs.statSync(path.join(roots.state, "bin/openclaw-acp-reasoning-cn.mjs")).mode & 0o777, 0o700);

	const portableFiles = [
		path.join(roots.openclaw, "dist/dispatch-acp-txw_fKCF.mjs"),
		path.join(roots.openclaw, "dist/bot-message-nRw-6GtF.mjs"),
		path.join(roots.adapter, "dist/acp-agent.js")
	];
	for (const filePath of portableFiles) {
		const text = fs.readFileSync(filePath, "utf8");
		assert.equal(text.includes(fixtureRoot), false);
		assert.equal(/^import .* from "file:\/\//m.test(text), false);
	}
	assert.match(fs.readFileSync(portableFiles[1], "utf8"), /resolveStateDir\(process\.env,os\.homedir\)/);

	const second = applyOverlay(options);
	assert.equal(second.status, "already-installed");
	assert.equal(second.changed, 0);
	// Reconstruct r1: three previously patched bundles plus three untouched stock
	// bundles. The other fourteen targets already have their final bytes.
	const upgradeBefore = new Map();
	for (const spec of manifest.targets) {
		const prior = path.join(fixtureRoot, "r1", spec.payload);
		const newlyCovered = ["dist/manager-DTkVUGeR.mjs", "dist/ingress-drain-HjcOOU41.mjs", "dist/telegram-ingress-drain-factory-EIOjXZiY.mjs"].includes(spec.path);
		if (!fs.existsSync(prior) && !newlyCovered) continue;
		const bytes = fs.readFileSync(newlyCovered ? path.join(sourceRoots[spec.root], spec.path) : prior);
		fs.writeFileSync(path.join(roots[spec.root], spec.path), bytes);
		upgradeBefore.set(spec, bytes);
	}
	assert.equal(upgradeBefore.size, 6);
	const upgradeInspection = inspectOverlay(options);
	assert.equal(upgradeInspection.blocked.length, 0);
	assert.equal(upgradeInspection.targets.filter(entry => entry.status === "ready-replace").length, 6);
	assert.equal(upgradeInspection.targets.filter(entry => entry.status === "installed").length, 14);
	const upgrade = applyOverlay(options);
	assert.equal(upgrade.changed, 6);
	assert.ok(upgrade.inspection.targets.every(entry => entry.status === "installed"));
	for (const [spec, bytes] of upgradeBefore) {
		assert.deepEqual(fs.readFileSync(path.join(upgrade.backupDir, spec.root, spec.path)), bytes);
	}
	assert.equal(applyOverlay(options).changed, 0);
	console.log("PASS r1 → current: exactly 6 replacements, original-byte backups, idempotency");
	const r2Before = new Map();
	for (const spec of manifest.targets) {
		const prior = path.join(fixtureRoot, "r2", spec.payload);
		if (!fs.existsSync(prior)) continue;
		const bytes = fs.readFileSync(prior);
		fs.writeFileSync(path.join(roots[spec.root], spec.path), bytes);
		r2Before.set(spec, bytes);
	}
	assert.equal(r2Before.size, 2);
	const r2Inspection = inspectOverlay(options);
	assert.equal(r2Inspection.blocked.length, 0);
	assert.equal(r2Inspection.targets.filter(entry => entry.status === "ready-replace").length, 2);
	assert.equal(r2Inspection.targets.filter(entry => entry.status === "installed").length, 18);
	const r2Upgrade = applyOverlay(options);
	assert.equal(r2Upgrade.changed, 2);
	assert.ok(r2Upgrade.inspection.targets.every(entry => entry.status === "installed"));
	for (const [spec, bytes] of r2Before) {
		assert.deepEqual(fs.readFileSync(path.join(r2Upgrade.backupDir, spec.root, spec.path)), bytes);
	}
	assert.equal(applyOverlay(options).changed, 0);
	console.log("PASS r2 → current: exactly 2 replacements, original-byte backups, idempotency");
	for (const command of ["verify", "apply"]) {
		const output = execFileSync(process.execPath, [path.join(overlayRoot, "overlay.mjs"), command,
			"--openclaw-root", roots.openclaw, "--acpx-root", roots.acpx, "--state-dir", roots.state], {encoding:"utf8"});
		assert.deepEqual(JSON.parse(output).roots, roots);
	}
	// Documented peer resolution, isolated from the host installation.
	const requireFromAcpx = createRequire(path.join(roots.acpx, "dist/config-D2FTk0K7.js"));
	assert.throws(() => requireFromAcpx.resolve("openclaw"), /Cannot find module/);
	fs.writeFileSync(path.join(roots.openclaw, "package.json"), JSON.stringify({name:"openclaw", version:manifest.versions.openclaw, main:"dist/index.js"}));
	fs.writeFileSync(path.join(roots.openclaw, "dist/index.js"), "// synthetic resolver fixture\n");
	fs.mkdirSync(path.join(roots.acpx, "node_modules"));
	fs.symlinkSync(roots.openclaw, path.join(roots.acpx, "node_modules/openclaw"), "dir");
	const peerRoot = path.resolve(path.dirname(requireFromAcpx.resolve("openclaw")), "..");
	assert.equal(fs.realpathSync(peerRoot), fs.realpathSync(roots.openclaw));
	assert.notEqual(fs.realpathSync(peerRoot), fs.realpathSync(roots.adapter));
	// Refuse unknown drift before touching any other target.
	const driftFile = path.join(roots.openclaw, manifest.targets[0].path);
	const original = fs.readFileSync(driftFile);
	fs.appendFileSync(driftFile, "\n// unexpected drift\n");
	assert.ok(inspectOverlay(options).blocked.length > 0);
	assert.throws(() => applyOverlay(options));
	fs.writeFileSync(driftFile, original);
	fs.writeFileSync(path.join(roots.openclaw, "package.json"), JSON.stringify({version:"0.0.0"}));
	assert.throws(() => inspectOverlay(options), /version mismatch/);
	assert.throws(() => applyOverlay(options));
	console.log(`PASS portable overlay apply/verify/backup/idempotency (${manifest.targets.length} targets)`);
} finally {
	fs.rmSync(tempRoot, { recursive: true, force: true });
}
