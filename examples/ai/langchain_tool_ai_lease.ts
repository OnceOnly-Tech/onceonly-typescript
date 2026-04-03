import { OnceOnly } from "../../src/index.js";
import type { AiResult } from "../../src/types.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");
const client = new OnceOnly({ apiKey });

const mode = process.env.EXAMPLE_MODE || "lease"; // lease | decorator

function refundPayment(userId: string, amount: number): string {
  console.log(`  >>> [SIDE EFFECT] Refunding $${amount} to ${userId}`);
  return "refund_processed";
}

async function invokeOnce(inputs: { user_id: string; amount: number }): Promise<string> {
  const key = `ai:tool:refund:${inputs.user_id}:${inputs.amount}`;

  const lease = await client.ai.lease(key, 3600, { agent: "demo", trace_id: "trace_123" });
  if (lease.status !== "acquired") {
    return "duplicate_blocked";
  }

  const leaseId = typeof lease.lease_id === "string" ? lease.lease_id : "";
  if (!leaseId) {
    return "duplicate_blocked";
  }

  try {
    const out = refundPayment(inputs.user_id, inputs.amount);
    await client.ai.complete(key, leaseId, { ok: true, output: out });
    return out;
  } catch (err) {
    await client.ai.fail(key, leaseId, "tool_error");
    throw err;
  }
}

function aiResultOutput(res: AiResult): string {
  const out = res.result?.output;
  return typeof out === "string" ? out : String(out ?? "");
}

async function refundTool(userId: string, amount: number): Promise<string> {
  const key = `ai:tool:refund:${userId}:${amount}`;
  const res = await client.ai.runFn(
    key,
    async () => {
      const out = refundPayment(userId, amount);
      return { output: out };
    },
    {
      ttl: 3600,
      metadata: { agent: "demo", trace_id: "trace_123" }
    }
  );
  return aiResultOutput(res);
}

async function main(): Promise<void> {
  if (mode === "lease") {
    console.log("--- 1st execution ---");
    console.log(await invokeOnce({ user_id: "u_102", amount: 50 }));

    console.log("\n--- 2nd execution (duplicate) ---");
    console.log(await invokeOnce({ user_id: "u_102", amount: 50 }));

    console.log("\n--- 3rd execution (different args) ---");
    console.log(await invokeOnce({ user_id: "u_777", amount: 50 }));
    return;
  }

  if (mode === "decorator") {
    console.log("\n--- Decorator version ---");
    console.log(await refundTool("u_102", 50));
    console.log(await refundTool("u_102", 50));
  }
}

void main();
