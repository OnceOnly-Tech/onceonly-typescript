/**
 * Async decorator example with idempotent.
 *
 * What this shows:
 * - async side-effect is deduplicated by args
 * - duplicate call returns static duplicate marker
 */

import { OnceOnly, idempotent } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

const chargeCustomer = idempotent(
  client,
  async (customerId: string, amount: number) => {
    console.log(`  >>> Charging ${customerId} $${amount}...`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return "SUCCESS";
  },
  {
    keyPrefix: "example:async",
    ttl: 60,
    returnValueOnDuplicate: "DUPLICATE"
  }
);

async function main() {
  console.log("--- 1. First Charge ---");
  const res1 = await chargeCustomer("c_1", 100);
  console.log(`Result: ${res1}`);

  console.log("\n--- 2. Duplicate Charge ( Returns 'DUPLICATE') ---");
  const res2 = await chargeCustomer("c_1", 100);
  console.log(`Result: ${res2}`);
}

void main();
