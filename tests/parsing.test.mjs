import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, OnceOnly } from "../dist/index.js";
import { makeFetchQueue, makeResponse } from "./helpers.mjs";

test("checkLock parses locked and duplicate responses", async () => {
  const { fetchImpl } = makeFetchQueue([
    makeResponse(
      200,
      { success: true, status: "locked", key: "a", ttl: 60 },
      { "X-OnceOnly-Status": "locked", "X-Request-Id": "rid1" }
    ),
    makeResponse(
      200,
      { success: false, status: "duplicate", key: "a", ttl: 60, first_seen_at: "2026-01-06T10:00:00Z" },
      { "X-OnceOnly-Status": "duplicate", "X-Request-Id": "rid2" }
    )
  ]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl });
  const first = await client.checkLock({ key: "a", ttl: 60 });
  const second = await client.checkLock({ key: "a", ttl: 60 });
  assert.equal(first.locked, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.firstSeenAt, "2026-01-06T10:00:00Z");
});

test("checkLock parses 409 duplicate mode", async () => {
  const { fetchImpl } = makeFetchQueue([
    makeResponse(409, {
      detail: { error: "Duplicate blocked", first_seen_at: "2026-01-06T10:00:00Z" }
    })
  ]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl });
  const out = await client.checkLock({ key: "a", ttl: 60 });
  assert.equal(out.duplicate, true);
  assert.equal(out.locked, false);
  assert.equal(out.firstSeenAt, "2026-01-06T10:00:00Z");
});

test("checkLock raises ApiError for 500", async () => {
  const { fetchImpl } = makeFetchQueue([makeResponse(500, { detail: "boom" })]);
  const client = new OnceOnly({ apiKey: "k", fetchImpl, failOpen: false });
  await assert.rejects(() => client.checkLock({ key: "a", ttl: 60 }), ApiError);
});
