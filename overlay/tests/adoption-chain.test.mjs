#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const STAGED_DIST = path.resolve(import.meta.dirname, "../payload/openclaw/dist");

function count(text, needle) {
  return text.split(needle).length - 1;
}

const dispatch = fs.readFileSync(path.join(STAGED_DIST, "dispatch-from-config-CmAXENud.mjs"), "utf8");
const acpx = fs.readFileSync(path.join(STAGED_DIST, "acpx-BDOdDqge.mjs"), "utf8");
const dispatchAcp = fs.readFileSync(path.join(STAGED_DIST, "dispatch-acp-txw_fKCF.mjs"), "utf8");
const manager = fs.readFileSync(path.join(STAGED_DIST, "manager-DTkVUGeR.mjs"), "utf8");

assert.equal(count(dispatch, "onTurnAdopted: async () => {"), 1);
assert.equal(count(acpx, "onTurnAdopted: ctx.onTurnAdopted"), 1);
assert.equal(count(dispatchAcp, "onTurnAdopted: params.onTurnAdopted"), 1);
assert.equal(count(manager, "if (authoritative) await input.onTurnAdopted?.();"), 1);
assert.equal(count(manager, "onPromptStarted: async ({ authoritative }) =>"), 1);

// Execute the actual staged manager callback body in isolation. This checks the
// semantic gate: fallback/non-authoritative readiness cannot tombstone ingress.
const callbackMarker = "\t\t\t\t\t\tonPromptStarted: async ({ authoritative }) => {";
const callbackStart = manager.indexOf(callbackMarker);
const callbackEnd = manager.indexOf("\n\t\t\t\t\t\t},\n\t\t\t\t\t\tonOutputEvent:", callbackStart);
assert.ok(callbackStart >= 0 && callbackEnd > callbackStart, "manager prompt-start callback slice missing");
const callbackBody = manager.slice(callbackStart + callbackMarker.length, callbackEnd);

async function executeManagerCallback(authoritative, { failAdoption = false } = {}) {
  const observations = { adopted: 0, bound: 0, lifecycle: 0 };
  const sandbox = {
    promptStarted: null,
    taskExecutionBound: false,
    taskRecord: { id: "task" },
    input: {
      admittedRunContext: { id: "run" },
      onTurnAdopted: async () => {
        observations.adopted += 1;
        if (failAdoption) throw new Error("synthetic adoption failure");
      },
      onLifecycle: async (event) => {
        observations.lifecycle += 1;
        assert.equal(event.type, "prompt_submitted");
      },
    },
    params: { deps: {} },
    sessionKey: "agent:probe:acp:fixture",
    bindBackgroundTaskExecution: () => { observations.bound += 1; },
    logVerbose: () => {},
    Date,
  };
  const callback = vm.runInNewContext(`(async ({ authoritative }) => {${callbackBody}\n})`, sandbox);
  await callback({ authoritative });
  return { observations, sandbox };
}

const fallback = await executeManagerCallback(false);
assert.deepEqual(fallback.observations, { adopted: 0, bound: 0, lifecycle: 1 });
assert.equal(fallback.sandbox.promptStarted, false);

const accepted = await executeManagerCallback(true);
assert.deepEqual(accepted.observations, { adopted: 1, bound: 1, lifecycle: 1 });
assert.equal(accepted.sandbox.promptStarted, true);
assert.equal(accepted.sandbox.taskExecutionBound, true);

await assert.rejects(executeManagerCallback(true, { failAdoption: true }), /synthetic adoption failure/);

// Exercise the actual staged ACP SDK hook body, with its lazy runtime replaced
// by a local function. This proves callback identity survives the SDK seam.
const hookStart = acpx.indexOf("async function tryDispatchAcpReplyHook(");
const hookEnd = acpx.indexOf("//#endregion", hookStart);
assert.ok(hookStart >= 0 && hookEnd > hookStart, "ACP hook slice missing");
let forwarded;
const hook = vm.runInNewContext(`(${acpx.slice(hookStart, hookEnd)})`, {
  isFinalizedInboundContext: () => true,
  hasExplicitCommandContextText: () => false,
  loadDispatchAcpRuntime: async () => ({
    shouldBypassAcpDispatchForCommand: async () => false,
    tryDispatchAcpReply: async (params) => {
      forwarded = params;
      return { queuedFinal: false, counts: {} };
    },
  }),
});
const adoptionCallback = async () => {};
await hook({ ctx: {}, sendPolicy: "allow" }, { cfg: {}, onTurnAdopted: adoptionCallback });
assert.equal(forwarded.onTurnAdopted, adoptionCallback);

console.log("PASS authoritative adoption gate and ACP hook forwarding");
