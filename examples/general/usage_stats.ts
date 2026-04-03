/**
 * Account and usage stats example.
 *
 * What this shows:
 * - fetch authenticated account info via /me
 * - fetch usage bucket via /usage?kind=make
 * - fetch AI usage via /usage?kind=ai
 * - fetch combined buckets via /usage/all
 */

import { OnceOnly } from "../../src/index.js";
import type { JsonMap } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

function printSection(title: string, data: JsonMap): void {
  console.log(`\n== ${title} ==`);
  const keys = Object.keys(data).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const value = data[key];
    const rendered =
      value !== null && typeof value === "object" ? JSON.stringify(value) : String(value);
    console.log(`${key.padEnd(28)}: ${rendered}`);
  }
}

async function main() {
  const me = await client.me();
  const usageMake = await client.usage("make");
  const usageAi = await client.usage("ai");
  const usageAll = await client.usageAll();

  printSection("/me", me);
  printSection("/usage?kind=make", usageMake);
  printSection("/usage?kind=ai", usageAi);
  printSection("/usage/all", usageAll);
}

void main();
