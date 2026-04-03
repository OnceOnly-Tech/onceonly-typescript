/**
 * runAndWait for server-side AI job.
 *
 * What this shows:
 * - one idempotency key maps to one real job/action
 * - wait until backend worker completes the run
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

async function main() {
  // One idempotency key = one real-world job/action.
  const key = "ai:job:daily-summary:2026-01-09";

  console.log("Starting AI job (server-side worker)...");

  const res = await client.ai.runAndWait({
    key,
    ttl: 300, // lock window for the job
    timeout: 60, // how long we wait client-side
    metadata: {
      task: "daily_summary",
      model: "gpt-4.1"
    }
  });

  if (!("status" in res)) {
    console.log("Final status:", "n/a");
    console.log("Result:", "result" in res ? (res.result ?? null) : null);
    console.log("Error:", null);
    return;
  }

  console.log("Final status:", res.status);
  console.log("Result:", res.result ?? null);
  console.log("Error:", res.errorCode ?? null);
}

void main();
