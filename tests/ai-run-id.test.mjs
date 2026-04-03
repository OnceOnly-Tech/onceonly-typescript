import assert from "node:assert/strict";
import test from "node:test";

import { OnceOnly } from "../dist/index.js";
import { makeFetchQueue, makeResponse } from "./helpers.mjs";

test("ai.run injects runId into metadata for key mode", async () => {
  const { fetchImpl, calls } = makeFetchQueue([
    makeResponse(200, { ok: true, status: "acquired", key: "ai:k", lease_id: "lease_1", version: 1 })
  ]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl });
  await client.ai.run({ key: "ai:k", metadata: { agent_id: "billing-agent" }, runId: "run_123" });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.metadata.agent_id, "billing-agent");
  assert.equal(body.metadata.run_id, "run_123");
});

test("ai.run injects runId into args for tool mode", async () => {
  const { fetchImpl, calls } = makeFetchQueue([
    makeResponse(200, { ok: true, allowed: true, decision: "executed", result: { ok: true } })
  ]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl });
  const out = await client.ai.run({
    agentId: "billing-agent",
    tool: "stripe.charge",
    args: { amount: 9999 },
    runId: "run_tool_1"
  });
  assert.equal(out.allowed, true);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.args.amount, 9999);
  assert.equal(body.args.run_id, "run_tool_1");
});

test("ai.run rejects empty runId", async () => {
  const { fetchImpl } = makeFetchQueue([]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl });
  await assert.rejects(() => client.ai.run({ key: "ai:k", runId: "   " }), /run_id must not be empty/);
});
