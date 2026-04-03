/**
 * Fail-open behavior demo for checkLock.
 *
 * What this shows:
 * - with failOpen=true and network failure, SDK returns a safe fallback
 * - raw payload includes fail_open reason for observability
 */

import { OnceOnly } from "../../src/index.js";

const client = new OnceOnly({
  apiKey: process.env.ONCEONLY_API_KEY || "once_live_demo",
  baseUrl: "https://127.0.0.1:65535/v1",
  failOpen: true,
  timeoutMs: 300
});

async function main() {
  console.log("Using unreachable baseUrl https://127.0.0.1:65535/v1 to simulate network failure.");
  console.log("Expected underlying error: connection refused (ECONNREFUSED).");
  const out = await client.checkLock({ key: "demo:fail-open", ttl: 60 });
  console.log("SDK fail-open fallback result:");
  console.log(out.raw);
}

void main();
