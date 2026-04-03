/**
 * Basic idempotency example with a stable business key.
 *
 * What this shows:
 * - use one key per real side-effect (charge/email/refund)
 * - duplicate calls with same key are safely blocked
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) {
  throw new Error("Set ONCEONLY_API_KEY");
}

const client = new OnceOnly({ apiKey });

async function main() {
  const key = "example:basic:order-123:charge";
  const ttl = 60;

  console.log("== 1st call ==");
  const first = await client.checkLock({ key, ttl });
  console.log(
    `locked=${first.locked} duplicate=${first.duplicate} ttl=${first.ttl} request_id=${first.requestId}`
  );

  if (first.shouldProceed()) {
    console.log(">>> Execute the side-effect now (charge/email/refund/etc.)");
  } else {
    console.log(">>> Skipped");
  }

  console.log("\n== 2nd call (duplicate) ==");
  const second = await client.checkLock({ key, ttl });
  console.log(
    `locked=${second.locked} duplicate=${second.duplicate} first_seen_at=${second.firstSeenAt}`
  );
}

void main();
