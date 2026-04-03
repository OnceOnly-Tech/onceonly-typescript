/**
 * checkLock with metadata example.
 *
 * What this shows:
 * - attach correlation fields in metadata
 * - inspect duplicate response for metadata traceability
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

async function main() {
  const key = "example:metadata:invoice-42";
  const meta = {
    source: "examples",
    scenario_id: "make:12345",
    user_id: "u_001",
    trace_id: "trace_demo_1"
  };

  console.log("== 1st call ==");
  const first = await client.checkLock({ key, ttl: 60, meta });
  console.log(`locked=${first.locked} duplicate=${first.duplicate} request_id=${first.requestId}`);
  console.log("sent_meta:", meta);

  console.log("\n== 2nd call (duplicate) ==");
  const second = await client.checkLock({ key, ttl: 60, meta });
  console.log(`locked=${second.locked} duplicate=${second.duplicate} first_seen_at=${second.firstSeenAt}`);
  console.log("server_raw_metadata:", second.raw.metadata ?? second.raw.meta);
}

void main();
