/**
 * Simple ai.runAndWait example.
 *
 * What this shows:
 * - start or attach run by key
 * - block until completed/failed (or timeout)
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

async function main() {
  const result = await client.ai.runAndWait({
    key: "report:daily:2026-04-01",
    ttl: 1800,
    timeout: 120
  });
  console.log(result);
}

void main();
