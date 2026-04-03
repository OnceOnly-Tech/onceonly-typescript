/**
 * Quick start for checkLock.
 *
 * What this shows:
 * - first call acquires lock for the key
 * - second call is detected as duplicate
 */

import { OnceOnly } from "../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

async function main() {
  const key = "quickstart:demo:key";
  const first = await client.checkLock({ key, ttl: 60 });
  const second = await client.checkLock({ key, ttl: 60 });

  console.log(`First call: locked=${first.locked}, duplicate=${first.duplicate}`);
  console.log(`Second call: locked=${second.locked}, duplicate=${second.duplicate}`);
}

void main();
