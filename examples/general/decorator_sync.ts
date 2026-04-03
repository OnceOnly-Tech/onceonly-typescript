/**
 * Sync-style function guarded by idempotent decorator.
 *
 * What this shows:
 * - repeated calls with same args are deduplicated
 * - different args execute side-effect normally
 */

import { OnceOnly, idempotent } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

const sendEmail = idempotent(
  client,
  async (to: string, subject: string) => {
    console.log(`  >>> [SIDE EFFECT] Sending email to=${to} subject=${subject}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return "SENT";
  },
  {
    keyPrefix: "example:decorator:sync",
    ttl: 60,
    returnValueOnDuplicate: "DUPLICATE"
  }
);

async function main() {
  console.log("== Call 1 ==");
  console.log(await sendEmail("alice@example.com", "Welcome"));

  console.log("\n== Call 2 (duplicate args) ==");
  console.log(await sendEmail("alice@example.com", "Welcome"));

  console.log("\n== Call 3 (different args) ==");
  console.log(await sendEmail("bob@example.com", "Welcome"));
}

void main();
