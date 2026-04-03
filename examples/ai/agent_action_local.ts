/**
 * Local side-effect guard using AI Lease API.
 *
 * What this shows:
 * - local side-effect with exactly-once semantics
 * - safe retries via lease/complete/fail flow
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });
const key = (process.env.ONCEONLY_ACTION_KEY || "").trim() || "ai:agent:charge:user_42:invoice_101";

async function doSideEffect(): Promise<Record<string, unknown>> {
  // (charge, refund, email, etc.)
  console.log(">>> Charging...");
  return { ok: true };
}

async function main() {
  try {
    console.log(`key=${key}`);
    const lease = await client.ai.lease(key, 300, {
      kind: "charge",
      user: "user_42",
      invoice: "100"
    });
    const status = String(lease.status ?? "").toLowerCase();

    if (status === "acquired") {
      const leaseId = typeof lease.lease_id === "string" ? lease.lease_id : undefined;
      if (!leaseId) {
        throw new Error(`Missing lease_id in response: ${JSON.stringify(lease)}`);
      }
      try {
        const result = await doSideEffect();
        await client.ai.complete(key, leaseId, result);
        console.log("Done.");
        return;
      } catch (err) {
        await client.ai.fail(key, leaseId, "charge_failed");
        throw err;
      }
    }

    if (status === "completed") {
      const res = await client.ai.result(key);
      console.log(`Already done previously: ${JSON.stringify(res.result ?? null)}`);
      return;
    }

    if (status === "failed") {
      const res = await client.ai.result(key);
      console.log(`Previously failed: ${res.errorCode ?? null}`);
      return;
    }

    console.log(`Action in progress by another worker. Status: ${status}`);
  } catch (err) {
    console.log(`SDK or Network error: ${String(err)}`);
  }
}

void main();
