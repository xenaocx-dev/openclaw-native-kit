#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const STAGED_DIST = path.resolve(import.meta.dirname, "../payload/openclaw/dist");
assert.ok(process.env.OPENCLAW_TEST_ROOT, "set OPENCLAW_TEST_ROOT to a complete OpenClaw 2026.9.4 package (read-only)");
const runtimeRoot = path.resolve(process.env.OPENCLAW_TEST_ROOT);
assert.equal(JSON.parse(fs.readFileSync(path.join(runtimeRoot, "package.json"), "utf8")).version, "2026.9.4");
const CORE_DIST = path.join(runtimeRoot, "dist");
const ingressName = "ingress-drain-HjcOOU41.mjs";
const ingressTarget = pathToFileURL(path.join(CORE_DIST, ingressName)).href;
const ingressSource = fs.readFileSync(path.join(STAGED_DIST, ingressName), "utf8");

registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (!url.startsWith(ingressTarget)) return result;
    return { ...result, source: ingressSource };
  },
});

const { n: createChannelIngressDrain } = await import(`${ingressTarget}?fixture-timeout-test`);
const { isTelegramSpooledHandlerTimeoutAbortReason } = await import(
  pathToFileURL(path.join(STAGED_DIST, "openclaw-acp-reasoning-terminal-v38.mjs"))
);

const telegramSource = fs.readFileSync(
  path.join(STAGED_DIST, "telegram-ingress-drain-factory-EIOjXZiY.mjs"),
  "utf8",
);
const helperStart = telegramSource.indexOf("const TELEGRAM_SPOOLED_HANDLER_TIMEOUT_ABORT_CODE");
const helperEnd = telegramSource.indexOf("\nconst TELEGRAM_SPOOLED_DRAIN_START_LIMIT", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "Telegram timeout reason helper slice missing");
const createTelegramSpooledHandlerTimeoutAbortReason = new Function(
  `${telegramSource.slice(helperStart, helperEnd)}\nreturn createTelegramSpooledHandlerTimeoutAbortReason;`,
)();
assert.equal(
  telegramSource.split("createAdoptionStallError: createTelegramSpooledHandlerTimeoutAbortReason").length - 1,
  1,
);

function fixture(id) {
  const laneKey = "telegram:default:group:probe:topic:1";
  const claim = {
    id,
    laneKey,
    payload: { update: { update_id: Number(id) } },
    attempt: 0,
    receivedAt: Date.now(),
    claim: { ownerId: "fixture-owner", token: `token-${id}`, claimedAt: Date.now() },
  };
  let claimed = false;
  const writes = { completed: [], released: [], failed: [] };
  const queue = {
    recoverStaleClaims: async () => 0,
    listPending: async () => claimed ? [] : [claim],
    listClaims: async () => [],
    claimNext: async () => {
      if (claimed) return null;
      claimed = true;
      return claim;
    },
    refreshClaim: async () => true,
    complete: async (event) => { writes.completed.push(event); return true; },
    release: async (event, options) => { writes.released.push({ event, options }); return true; },
    fail: async (event, options) => { writes.failed.push({ event, options }); return true; },
  };
  return { claim, laneKey, queue, writes };
}

async function waitUntil(predicate, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("timed out waiting for ingress settlement");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

// Adoption before the watchdog must tombstone once and must not abort a long turn.
{
  const f = fixture("0000000000000101");
  let aborted = false;
  const drain = createChannelIngressDrain({
    queue: f.queue,
    ownerId: "fixture-adopt-test",
    adoptionStallTimeoutMs: 20,
    claimLeaseMs: 60_000,
    dispatchClaimedEvent: async (_claim, lifecycle) => {
      lifecycle.abortSignal.addEventListener("abort", () => { aborted = true; }, { once: true });
      await lifecycle.onAdopted();
      await new Promise((resolve) => setTimeout(resolve, 60));
      return { kind: "completed" };
    },
  });
  assert.deepEqual(await drain.drainOnce(), { started: 1 });
  await drain.waitForIdle();
  assert.equal(aborted, false);
  assert.equal(f.writes.completed.length, 1);
  assert.equal(f.writes.released.length, 0);
  drain.dispose();
}

// A genuine pre-adoption stall must carry Telegram update identity all the way
// to the existing reasoning terminal matcher and retry disposition.
{
  const id = "0000000000000102";
  const f = fixture(id);
  let abortReason;
  const logs = [];
  const drain = createChannelIngressDrain({
    queue: f.queue,
    ownerId: "fixture-timeout-test",
    adoptionStallTimeoutMs: 20,
    claimLeaseMs: 60_000,
    createAdoptionStallError: createTelegramSpooledHandlerTimeoutAbortReason,
    onLog: (message) => logs.push(message),
    dispatchClaimedEvent: async (_claim, lifecycle) => await new Promise((resolve) => {
      lifecycle.abortSignal.addEventListener("abort", () => {
        abortReason = lifecycle.abortSignal.reason;
        resolve({ kind: "failed-retryable", error: abortReason });
      }, { once: true });
    }),
  });
  assert.deepEqual(await drain.drainOnce(), { started: 1 });
  await waitUntil(() => f.writes.released.length === 1);
  await drain.waitForIdle();
  assert.ok(abortReason instanceof Error);
  assert.equal(abortReason.code, "TELEGRAM_SPOOLED_HANDLER_TIMEOUT");
  assert.equal(abortReason.updateId, 102);
  assert.equal(abortReason.eventId, id);
  assert.equal(abortReason.laneKey, f.laneKey);
  assert.equal(isTelegramSpooledHandlerTimeoutAbortReason(abortReason, 102), true);
  assert.equal(f.writes.completed.length, 0);
  assert.equal(f.writes.failed.length, 0);
  assert.match(f.writes.released[0].options.lastError, /claim→adoption stalled/);
  assert.ok(logs.some((message) => message.includes("applying retry policy")));
  drain.dispose();
}

process.stdout.write("Offline ingress adoption watchdog contract: PASS\n");
