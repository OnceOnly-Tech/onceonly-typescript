/**
 * Poll run status by key until completion.
 *
 * What this shows:
 * - start/attach run via ai.run
 * - poll ai.status using retryAfterSec hint
 * - fetch final result via ai.result
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const key = (process.env.ONCEONLY_RUN_KEY || "").trim() || "ai:job:example:poll-status";

  // Start/attach
  const run = await client.ai.run({
    key,
    ttl: 120,
    metadata: { demo: true }
  });

  if (!("status" in run)) {
    throw new Error("Expected ai.run key-mode response");
  }
  console.log("run status:", run.status, "version:", run.version, "lease:", run.leaseId);

  // Poll using backend hint retry_after_sec
  for (;;) {
    const st = await client.ai.status(key);
    console.log(
      "status:",
      st.status,
      "ttl_left:",
      st.ttlLeft ?? null,
      "retry_after:",
      st.retryAfterSec ?? null,
      "ver:",
      st.version
    );

    if (st.status === "completed" || st.status === "failed") {
      break;
    }

    const sleepSeconds = st.retryAfterSec ?? 1;
    const boundedSeconds = Math.max(1, Math.min(10, Math.trunc(sleepSeconds)));
    await sleep(boundedSeconds * 1000);
  }

  const out = await client.ai.result(key);
  console.log("result status:", out.status);
  console.log("result:", out.result ?? null);
  console.log("error_code:", out.errorCode ?? null);
}

void main();
