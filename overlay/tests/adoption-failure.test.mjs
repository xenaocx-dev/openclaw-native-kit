import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";

const dist = path.resolve(import.meta.dirname, "../payload/openclaw/dist");
const manager = fs.readFileSync(path.join(dist, "manager-DTkVUGeR.mjs"), "utf8");
const dispatch = fs.readFileSync(path.join(dist, "dispatch-from-config-CmAXENud.mjs"), "utf8");
const ingress = fs.readFileSync(path.join(dist, "ingress-drain-HjcOOU41.mjs"), "utf8");
function slice(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `missing source seam: ${start}`);
  return source.slice(a, b);
}
// Execute shipped code without importing services or host state. The native
// turn, persistence, scheduling delay, and dispatcher dependencies are fakes.
const consume = vm.runInNewContext(`${slice(manager,
  "function isCancellationStopReason(", "//#endregion\n//#region src/acp/control-plane/manager.turn-runner.ts")}; consumeAcpTurnStream`,
  { Promise, setTimeout });
const managerBody = slice(manager,
  "onPromptStarted: async ({ authoritative }) => {",
  "\n\t\t\t\t\t\t},\n\t\t\t\t\t\tonOutputEvent:").split("=> {").slice(1).join("=> {");
function promptCallback(onTurnAdopted) {
  return vm.runInNewContext(`(async ({ authoritative }) => {${managerBody}\n})`, {
    input: { onTurnAdopted }, taskRecord: null, taskExecutionBound: false,
    promptStarted: false, logVerbose: () => {}, sessionKey: "fixture",
  });
}
const runHook = vm.runInNewContext(`(${slice(dispatch,
  "function runReplyDispatchHook(", "async function retainUnclaimedAcpDispatch(")})`, {
  runtimeTakeoverHooksAllowed: () => true,
  runWithDispatchAbortSignal: (_signal, run) => run(),
  createReplyDispatchEvent: event => event,
});
async function dispatchFixture(onAdopted) {
  let hookContext;
  let replayUnsafe = false;
  const state = {
    allowInboundHandlers: true, dispatchKind: "acp", ctx: {}, replyRoute: {},
    params: { replyOptions: { turnAdoptionLifecycle: { onAdopted } } },
    hookRunner: { hasHooks: () => true, runReplyDispatch: (_event, ctx) => { hookContext = ctx; } },
    runWithDispatchLifecycleAdmission: run => run(),
    traceReplyPhase: (_label, run) => run(),
    getPreDispatchAbortSignal: () => undefined,
    shouldEmitFullVerboseProgress: () => false,
    markInboundDedupeReplayUnsafe: () => { replayUnsafe = true; },
  };
  await runHook(state, {});
  return { callback: hookContext.onTurnAdopted, replayUnsafe: () => replayUnsafe };
}
function nativeTurn({ cancelRejects = false } = {}) {
  const terminal = Promise.withResolvers();
  const observations = { started: 0, cancelled: 0, closed: 0, running: true };
  return {
    observations,
    finish(status = "cancelled") { observations.running = false; terminal.resolve({ status }); },
    runtime: { startTurn() {
      observations.started++;
      return {
        promptStarted: Promise.resolve(), result: terminal.promise,
        events: (async function* () { await terminal.promise; })(),
        async cancel() {
          observations.cancelled++;
          if (cancelRejects) throw new Error("synthetic cancel transport failure");
        },
        async closeStream() { observations.closed++; },
      };
    } },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

for (const failure of ["spool write failed", "ingress adoption lost: superseded", "ingress adoption lost: guillotined"]) {
  test(`authoritative callback failure stops the turn before reporting: ${failure}`, async () => {
    const turn = nativeTurn();
    const original = new Error(failure);
    const f = await dispatchFixture(async () => { throw original; });
    const gate = { open: true };
    let outcome;
    const work = consume({ runtime: turn.runtime, turn: {}, eventGate: gate,
      onPromptStarted: promptCallback(f.callback) }).then(
      result => { outcome = { result }; }, error => { outcome = { error }; });
    try {
      await tick();
      assert.equal(turn.observations.cancelled, 1, "native turn must receive cancellation");
      assert.equal(turn.observations.closed, 1, "event stream must be closed");
      assert.equal(gate.open, false, "no further output forwarded during failed adoption cleanup");
      assert.equal(outcome, undefined, "do not release manager ownership while turn is still running");
      assert.equal(f.replayUnsafe(), true, "already accepted input is unsafe to replay");
    } finally {
      turn.finish();
      await work;
    }
    assert.equal(outcome.error, original, "preserve original adoption failure");
    assert.equal(turn.observations.started, 1);
  });
}

test("cancel RPC failure still waits for the native terminal result", async () => {
  const turn = nativeTurn({ cancelRejects: true });
  const original = new Error("spool write failed");
  let error;
  const work = consume({ runtime: turn.runtime, turn: {}, eventGate: { open: true },
    onPromptStarted: promptCallback(async () => { throw original; }) }).catch(e => { error = e; });
  try {
    await tick();
    assert.equal(turn.observations.closed, 1);
    assert.equal(error, undefined);
  } finally { turn.finish(); await work; }
  assert.equal(error, original);
});

test("successful adoption keeps normal result and never cancels", async () => {
  const turn = nativeTurn();
  let adopted = 0;
  const f = await dispatchFixture(async () => { adopted++; });
  const gate = { open: true };
  const work = consume({ runtime: turn.runtime, turn: {}, eventGate: gate,
    onPromptStarted: promptCallback(f.callback) });
  await tick();
  turn.finish("completed");
  assert.equal((await work).terminalStatus, "completed");
  assert.equal(adopted, 1);
  assert.equal(turn.observations.cancelled, 0);
  assert.equal(gate.open, true);
});

test("failed adoption commits dispatcher dedupe; a later copy remains duplicate", async () => {
  const f = await dispatchFixture(async () => { throw new Error("spool write failed"); });
  assert.equal(f.replayUnsafe(), false, "constructing the hook alone must not mark an unsubmitted input");
  await assert.rejects(f.callback(), /spool write failed/);
  const catchBody = slice(dispatch, "async function dispatchReplyFromConfigInner(", "//#endregion");
  const disposition = slice(catchBody, 'if (inboundDedupeClaim.status === "claimed") {', '\n\t\t\tif (err instanceof');
  // Tiny fake dedupe store; execute the actual dispatcher catch disposition.
  const records = new Map([["message", "inflight"]]);
  const claim = { status: "claimed", commit: () => records.set("message", "duplicate"), release: () => records.delete("message") };
  vm.runInNewContext(disposition, {
    inboundDedupeClaim: claim,
    errorState: { turnAdoptionState: { adopted: false }, inboundDedupeReplayUnsafe: f.replayUnsafe() },
  });
  assert.equal(records.get("message"), "duplicate");
});

test("native completion wins over a slow adoption observer without late cancellation", async () => {
  const turn = nativeTurn();
  const observer = Promise.withResolvers();
  const work = consume({ runtime: turn.runtime, turn: {}, eventGate: { open: true },
    onPromptStarted: promptCallback(() => observer.promise) });
  await tick();
  turn.finish("completed");
  assert.equal((await work).terminalStatus, "completed");
  observer.reject(new Error("late storage failure"));
  await tick();
  assert.equal(turn.observations.cancelled, 0);
});

test("exhausted tombstone retries hold ingress claim; no watchdog or automatic requeue", async () => {
  const writes = { attempts: 0, releases: 0, failures: 0, cleared: 0 };
  const state = { phase: "dispatching", claim: { id: "fixture" }, abortController: new AbortController() };
  const scope = {
    Error, options: {}, queue: {
      complete: async () => { writes.attempts++; throw new Error("synthetic storage outage"); },
      release: async () => { writes.releases++; }, fail: async () => { writes.failures++; },
    }, now: Date.now, formatError: String, log: () => {}, isStopped: () => false,
    DEFAULT_INGRESS_RETRY_MAX_MS: 1, DEFAULT_INGRESS_RETRY_BASE_MS: 1,
    sleepWithAbort: async () => {}, // only retry delays are removed
    clearStallTimer: () => { writes.cleared++; },
    releaseUnadopted: () => { throw new Error("unexpected release"); },
    applyFailureDisposition: () => { throw new Error("unexpected retry disposition"); },
    state,
  };
  vm.createContext(scope);
  vm.runInContext(slice(ingress, "var IngressAdoptionLostError", "function activeClaimKey"), scope);
  vm.runInContext(slice(ingress, "const INGRESS_TOMBSTONE_RETRY_MAX_ATTEMPTS", "//#endregion"), scope);
  vm.runInContext(`const { completeClaimWithRetry } = createIngressWriter(options, {queue, now, formatError, log, isStopped});
    state.settleOnce = createIngressSettleOwner(state, () => {});`, scope);
  const lifecycle = vm.runInContext(`${slice(ingress, "const createLifecycle =", "\n\tconst supersedeActiveIfNeeded")}; createLifecycle(state)`, scope);
  const turn = nativeTurn();
  const f = await dispatchFixture(lifecycle.onAdopted);
  let failure;
  const work = consume({ runtime: turn.runtime, turn: {}, eventGate: { open: true },
    onPromptStarted: promptCallback(f.callback) }).catch(error => { failure = error; });
  try {
    await tick();
    assert.equal(turn.observations.cancelled, 1);
    assert.equal(failure, undefined, "manager waits for terminal result after storage failure");
    assert.equal(f.replayUnsafe(), true);
  } finally { turn.finish(); await work; }
  assert.match(failure.message, /synthetic storage outage/);
  assert.equal(state.phase, "adopted");
  assert.equal(writes.attempts, 8);
  assert.equal(writes.cleared, 1);
  assert.equal(writes.releases, 0);
  assert.equal(writes.failures, 0);
});
