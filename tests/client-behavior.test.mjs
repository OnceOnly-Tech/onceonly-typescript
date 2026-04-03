import assert from "node:assert/strict";
import test from "node:test";

import { OnceOnly, OverLimitError, UnauthorizedError, ValidationError } from "../dist/index.js";
import { makeFetchQueue, makeResponse } from "./helpers.mjs";

test("fail-open on network error", async () => {
  const { fetchImpl } = makeFetchQueue([new Error("network down")]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl, failOpen: true });
  const out = await client.checkLock({ key: "k1", ttl: 60 });
  assert.equal(out.locked, true);
  assert.equal(out.duplicate, false);
  assert.equal(out.raw.fail_open, true);
});

test("fail-open on fetch-style ECONNREFUSED error", async () => {
  const err = new Error("request to https://127.0.0.1:65535/v1/check-lock failed, reason: connect ECONNREFUSED 127.0.0.1:65535");
  err.name = "FetchError";
  err.code = "ECONNREFUSED";
  const { fetchImpl } = makeFetchQueue([err]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl, failOpen: true });
  const out = await client.checkLock({ key: "k2", ttl: 60 });
  assert.equal(out.locked, true);
  assert.equal(out.duplicate, false);
  assert.equal(out.raw.fail_open, true);
  assert.equal(out.raw.reason, "request_error");
});

test("4xx are not masked by fail-open", async () => {
  const queued = [
    makeResponse(401, { detail: "nope" }),
    makeResponse(403, { detail: "Forbidden" }),
    makeResponse(402, { detail: { error: "limit" } }),
    makeResponse(422, { detail: "invalid" })
  ];
  const { fetchImpl } = makeFetchQueue(queued);
  const client = new OnceOnly({ apiKey: "k", fetchImpl, failOpen: true });

  await assert.rejects(() => client.checkLock({ key: "a" }), UnauthorizedError);
  await assert.rejects(() => client.checkLock({ key: "a" }), UnauthorizedError);
  await assert.rejects(() => client.checkLock({ key: "a" }), OverLimitError);
  await assert.rejects(() => client.checkLock({ key: "a" }), ValidationError);
});

test("updateNotifications sends me/notifications payload", async () => {
  const { fetchImpl, calls } = makeFetchQueue([
    makeResponse(200, {
      email_notifications_enabled: true,
      tool_error_notifications_enabled: false,
      run_failure_notifications_enabled: true
    })
  ]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl });
  const out = await client.updateNotifications({ toolErrorNotificationsEnabled: false });
  assert.equal(out.tool_error_notifications_enabled, false);
  assert.match(calls[0].url, /\/me\/notifications$/);
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body, { tool_error_notifications_enabled: false });
});
