import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, OnceOnly, OverLimitError, UnauthorizedError } from "../dist/index.js";
import { makeFetchQueue, makeResponse } from "./helpers.mjs";

test("gov.upsertPolicy maps response shape", async () => {
  const { fetchImpl } = makeFetchQueue([
    makeResponse(200, {
      agent_id: "billing-agent",
      policy: {
        max_actions_per_hour: 200,
        max_spend_usd_per_day: 50,
        allowed_tools: ["stripe.charge"]
      }
    })
  ]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl });
  const policy = await client.gov.upsertPolicy({
    agent_id: "billing-agent",
    max_actions_per_hour: 200
  });
  assert.equal(policy.agentId, "billing-agent");
  assert.equal(policy.maxActionsPerHour, 200);
  assert.equal(policy.allowedTools[0], "stripe.charge");
});

test("gov disable/enable agent", async () => {
  const { fetchImpl } = makeFetchQueue([
    makeResponse(200, { agent_id: "a", is_enabled: false }),
    makeResponse(200, { agent_id: "a", is_enabled: true })
  ]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl });
  const st1 = await client.gov.disableAgent("a");
  const st2 = await client.gov.enableAgent("a");
  assert.equal(st1.isEnabled, false);
  assert.equal(st2.isEnabled, true);
});

test("gov typed errors", async () => {
  const cases = [
    [401, { detail: { error: "x" } }, UnauthorizedError],
    [403, { detail: "Forbidden" }, UnauthorizedError],
    [403, { detail: { error: "feature_not_available", message: "upgrade required" } }, ApiError],
    [403, { detail: { error: "plan_limit", message: "FREE plan limit: max 1 tools" } }, ApiError],
    [402, { detail: { error: "x" } }, OverLimitError],
    [500, { detail: { error: "x" } }, ApiError]
  ];

  for (const [status, body, cls] of cases) {
    const { fetchImpl } = makeFetchQueue([makeResponse(status, body)]);
    const client = new OnceOnly({ apiKey: "k", fetchImpl, failOpen: false });
    await assert.rejects(() => client.gov.upsertPolicy({ agent_id: "a" }), cls);
  }
});
