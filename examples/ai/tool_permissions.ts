/**
 * Tool permission policy example.
 *
 * What this shows:
 * - allowlist and blocklist tools for an agent
 * - auto-register missing demo tools when backend validates policy references
 */

import { ApiError, OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });
const toolBaseUrl = (process.env.ONCEONLY_TOOL_BASE_URL || "").trim().replace(/\/+$/, "") || "https://example.com/tools";
const toolSecret = (process.env.ONCEONLY_TOOL_SECRET || "").trim() || "example_secret_123";

const allowedTools = ["send_email", "stripe.refund"];
const blockedTools = ["stripe.charge", "delete_user"];

async function ensureToolRegistered(name: string): Promise<void> {
  await client.gov.createTool({
    name,
    url: `${toolBaseUrl}/${encodeURIComponent(name)}`,
    scope_id: "global",
    auth: { type: "hmac_sha256", secret: toolSecret },
    timeout_ms: 15000,
    max_retries: 2,
    enabled: true,
    description: "Auto-registered by examples/ai/tool_permissions.ts"
  });
  console.log(`  - ensured tool: ${name}`);
}

async function main() {
  const agentId = "support-bot";
  const policyPayload = {
    agent_id: agentId,
    allowed_tools: allowedTools,
    blocked_tools: blockedTools
  };

  console.log("Setting tool permission policy...");
  try {
    await client.gov.upsertPolicy(policyPayload);
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.detail &&
      typeof err.detail === "object" &&
      (err.detail as Record<string, unknown>).error === "unknown_tools"
    ) {
      console.log("Policy references unknown tools. Auto-registering demo tools in global scope...");
      const namesRaw = (err.detail as Record<string, unknown>).tools;
      const names = Array.isArray(namesRaw) && namesRaw.length > 0
        ? namesRaw.map((x) => String(x))
        : Array.from(new Set([...allowedTools, ...blockedTools]));

      for (const name of names) {
        await ensureToolRegistered(name);
      }
      await client.gov.upsertPolicy(policyPayload);
    } else {
      throw err;
    }
  }

  console.log("Policy applied.");
  console.log("\nThis agent can:");
  console.log("  ✓ send_email");
  console.log("  ✓ stripe.refund");

  console.log("\nThis agent CANNOT call:");
  console.log("  ✗ stripe.charge");
  console.log("  ✗ delete_user");

  console.log(
    "\nIf the agent tries to call a blocked tool via ai.runTool(), " +
      "you'll get allowed=false with a policyReason."
  );
}

void main();
