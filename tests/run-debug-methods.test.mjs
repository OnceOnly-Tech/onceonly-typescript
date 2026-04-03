import assert from "node:assert/strict";
import test from "node:test";

import { OnceOnly } from "../dist/index.js";
import { makeFetchQueue, makeResponse } from "./helpers.mjs";

test("postEvent calls /events with payload", async () => {
  const { fetchImpl, calls } = makeFetchQueue([
    makeResponse(200, { ok: true, event_id: 1, run_id: "run_1" })
  ]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl });
  const out = await client.postEvent({
    runId: "run_1",
    type: "tool_result",
    status: "ok",
    data: { duration: 120 },
    extra: { extra_field: "x" }
  });
  assert.equal(out.ok, true);
  assert.match(calls[0].url, /\/events$/);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.run_id, "run_1");
  assert.equal(body.type, "tool_result");
  assert.equal(body.extra_field, "x");
});

test("getRunTimeline calls /runs/{id} with query", async () => {
  const { fetchImpl, calls } = makeFetchQueue([
    makeResponse(200, { run_id: "run_1", total: 0, events: [] })
  ]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl });
  const out = await client.getRunTimeline("run x/y", 100, 10);
  assert.equal(out.run_id, "run_1");
  assert.match(calls[0].url, /\/runs\/run%20x%2Fy\?limit=100&offset=10$/);
});

test("postEvent validates required fields", async () => {
  const { fetchImpl } = makeFetchQueue([]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl });
  await assert.rejects(() => client.postEvent({ runId: "   ", type: "sdk_debug" }), /run_id must not be empty/);
  await assert.rejects(() => client.postEvent({ runId: "run_1", type: "  " }), /type must not be empty/);
});
