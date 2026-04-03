/**
 * Basic idempotent decorator example.
 *
 * What this shows:
 * - wraps function with checkLock-based dedup
 * - repeated calls with same key return duplicate-safe behavior
 */

import { OnceOnly, idempotent } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });
const scenarioId = (process.env.ONCEONLY_SCENARIO_ID || "").trim() || `demo_${Date.now()}`;

type WelcomeResult =
  | { sent: true; userId: string }
  | { sent: false; userId: string; duplicate: true };

const sendWelcome = idempotent(
  client,
  async (userId: string): Promise<WelcomeResult> => ({ sent: true, userId }),
  {
    keyPrefix: `welcome:${scenarioId}`,
    keyFn: (userId) => userId,
    ttl: 86400,
    onDuplicate: (userId): WelcomeResult => ({ sent: false, userId, duplicate: true })
  }
);

async function main() {
  console.log(`scenario_id=${scenarioId}`);
  console.log("== Call 1 ==");
  console.log(await sendWelcome("user_123"));

  console.log("\n== Call 2 (duplicate) ==");
  console.log(await sendWelcome("user_123"));

  console.log("\n== Call 3 (different args) ==");
  console.log(await sendWelcome("user_456"));
}

void main();
