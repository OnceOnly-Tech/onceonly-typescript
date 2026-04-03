/**
 * Webhook deduplication pattern.
 *
 * What this shows:
 * - key by external event id (e.g. Stripe event)
 * - duplicate webhook deliveries are ignored safely
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });
const eventId = (process.env.WEBHOOK_EVENT_ID || "").trim() || `evt_demo_${Math.floor(Date.now() / 1000)}`;

async function processStripeWebhook(eventIdValue: string) {
  const lock = await client.checkLock({
    key: `stripe:webhook:${eventIdValue}`,
    ttl: 7200
  });

  if (lock.duplicate) {
    return {
      lock,
      result: { status: "already_processed", action: "skipped_duplicate" }
    };
  }

  // This is where your real side-effect goes (charge, DB write, email, etc.).
  console.log("  >>> [SIDE EFFECT] Processing webhook payload once");
  return {
    lock,
    result: { status: "processed", action: "side_effect_executed" }
  };
}

async function main() {
  console.log(`event_id=${eventId}`);
  if (!(process.env.WEBHOOK_EVENT_ID || "").trim()) {
    console.log("Tip: set WEBHOOK_EVENT_ID to reuse an existing id across reruns.");
  }

  console.log("\n== 1st delivery ==");
  const first = await processStripeWebhook(eventId);
  console.log("lock:", {
    locked: first.lock.locked,
    duplicate: first.lock.duplicate,
    request_id: first.lock.requestId
  });
  console.log("result:", first.result);

  console.log("\n== 2nd delivery (duplicate) ==");
  const second = await processStripeWebhook(eventId);
  console.log("lock:", {
    locked: second.lock.locked,
    duplicate: second.lock.duplicate,
    request_id: second.lock.requestId
  });
  console.log("result:", second.result);
}

void main();
