import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const receipt = JSON.parse(fs.readFileSync(path.join(root, 'PACKAGE_FILES.json'), 'utf8'));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const ignored = new Set(['node_modules', '.git', 'REVIEW_RESULT.md', 'PACKAGE_FILES.json']);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (dir === root && ignored.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    assert.ok(!entry.isSymbolicLink(), `symlink not allowed: ${path.relative(root,p)}`);
    if (entry.isDirectory()) walk(p);
    else { assert.ok(entry.isFile()); files.push(path.relative(root,p)); }
  }
}
walk(root);
assert.deepEqual(files.sort(), receipt.files.map(x=>x.path).sort(), 'inventory drift');
const sensitive = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:ghp|github_pat|sk-ant-api\d+)_[A-Za-z0-9_]{20,}\b/,
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{32,}\b/,
  /\b\d{8,12}:[A-Za-z0-9_-]{32,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/,
  /-100\d{9,}\b/,
  /\/Users\/(?!example\/)[^\s/"'`]+\//
];
for (const entry of receipt.files) {
  const data = fs.readFileSync(path.join(root, entry.path));
  assert.equal(hash(data), entry.sha256, `hash drift: ${entry.path}`);
  assert.ok(!/(?:^|\/)(?:\.env(?:\.|$)|auth-profiles\.json$|credentials\.json$)|\.(?:sqlite(?:-wal|-shm)?|jsonl|log|bak)$/.test(entry.path), `runtime file: ${entry.path}`);
  const text = data.toString('utf8');
  assert.ok(!sensitive.some(pattern=>pattern.test(text)), `possible credential: ${entry.path}`);
  if (entry.path.endsWith('.json')) JSON.parse(text);
}
const overlay = JSON.parse(fs.readFileSync(path.join(root,'overlay/manifest.json'),'utf8'));
for (const spec of overlay.targets) {
  assert.equal(hash(fs.readFileSync(path.join(root,'overlay/payload',spec.payload))),spec.sha256);
}
console.log(`PASS package inventory/hash/JSON/basic credential scan: ${files.length} files; ${overlay.targets.length} payloads`);
