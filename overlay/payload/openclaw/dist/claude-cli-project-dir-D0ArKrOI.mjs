import { l as normalizeOptionalString } from "./string-coerce-CIXf7egm.mjs";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
//#region src/agents/command/claude-cli-project-dir.ts
/**
* Resolves Claude CLI project storage directories for OpenClaw workspaces.
*/
const CLAUDE_CONFIG_DIRNAME = ".claude";
const CLAUDE_PROJECTS_DIRNAME = "projects";
const MAX_SANITIZED_PROJECT_LENGTH = 200;
function simpleHash36(input) {
	let hash = 0;
	for (let index = 0; index < input.length; index += 1) hash = hash * 31 + input.charCodeAt(index) >>> 0;
	return hash.toString(36);
}
function sanitizeClaudeCliProjectKey(workspaceDir) {
	const sanitized = workspaceDir.replace(/[^a-zA-Z0-9]/g, "-");
	if (sanitized.length <= MAX_SANITIZED_PROJECT_LENGTH) return sanitized;
	return `${sanitized.slice(0, MAX_SANITIZED_PROJECT_LENGTH)}-${simpleHash36(workspaceDir)}`;
}
function canonicalizeWorkspaceDir(workspaceDir) {
	const resolved = path.resolve(workspaceDir).normalize("NFC");
	try {
		return fs.realpathSync.native(resolved).normalize("NFC");
	} catch {
		return resolved;
	}
}
/** Resolves Claude CLI's per-workspace project directory. */
function resolveClaudeCliProjectDirForWorkspace(params) {
	const explicitHomeDir = normalizeOptionalString(params.homeDir);
	const configuredDir = explicitHomeDir ? void 0 : normalizeOptionalString(process.env.CLAUDE_CONFIG_DIR);
	const projectsDir = configuredDir ? path.join(path.resolve(configuredDir), CLAUDE_PROJECTS_DIRNAME) : path.join(explicitHomeDir || process.env.HOME || os.homedir(), CLAUDE_CONFIG_DIRNAME, CLAUDE_PROJECTS_DIRNAME);
	const canonicalWorkspaceDir = canonicalizeWorkspaceDir(params.workspaceDir);
	return path.join(projectsDir, sanitizeClaudeCliProjectKey(canonicalWorkspaceDir));
}
//#endregion
export { resolveClaudeCliProjectDirForWorkspace as t };
