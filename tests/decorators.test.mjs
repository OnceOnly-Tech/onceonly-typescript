import assert from "node:assert/strict";
import test from "node:test";

import { OnceOnly, idempotentAi } from "../dist/index.js";
import { makeFetchQueue, makeResponse } from "./helpers.mjs";

test("idempotentAi forwards key and metadata into ai.runFn flow", async () => {
  const { fetchImpl } = makeFetchQueue([
    makeResponse(200, { status: "acquired", lease_id: "l1" }),
    makeResponse(200, { ok: true }),
    makeResponse(200, { ok: true, status: "completed", key: "ai:charge:u1:inv1", result: { ok: true } })
  ]);

  const client = new OnceOnly({ apiKey: "k", fetchImpl });

  const fn = idempotentAi(
    client,
    async (_user, _inv) => ({ charged: true }),
    {
      keyFn: (user, inv) => `ai:charge:${user}:${inv}`,
      ttl: 123,
      metadataFn: (user, inv) => ({ user, invoice: inv })
    }
  );

  const out = await fn("u1", "inv1");
  assert.equal(out.status, "completed");
});
