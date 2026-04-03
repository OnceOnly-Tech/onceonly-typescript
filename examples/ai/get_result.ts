/**
 * Fetch final run result by key.
 *
 * What this shows:
 * - when key is known and run is done, get result directly
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

const key = process.env.ONCEONLY_RUN_KEY || "ai:demo:key";
void client.ai.result(key).then(console.log);
