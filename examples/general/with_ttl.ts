/**
 * checkLock with short custom TTL.
 *
 * What this shows:
 * - duplicate is blocked while lock is active
 * - lock expires after TTL and allows execution again
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const key = "example:ttl:short-lived";
  const ttlSeconds = 10; // Backend minimum TTL is 10s.

  console.log(`== TTL demo (ttl=${ttlSeconds}s) ==`);

  const first = await client.checkLock({ key, ttl: ttlSeconds });
  console.log(`1st: locked=${first.locked} duplicate=${first.duplicate}`);

  const second = await client.checkLock({ key, ttl: ttlSeconds });
  console.log(`2nd: locked=${second.locked} duplicate=${second.duplicate} (expected duplicate)`);

  console.log(`Sleeping ${ttlSeconds + 1}s...`);
  await sleep((ttlSeconds + 1) * 1000);

  const third = await client.checkLock({ key, ttl: ttlSeconds });
  console.log(`3rd: locked=${third.locked} duplicate=${third.duplicate} (expected locked again)`);
}

void main();
