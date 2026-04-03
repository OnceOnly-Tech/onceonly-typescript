/**
 * Budget limits policy example.
 *
 * What this shows:
 * - set hourly action and daily spend caps
 * - read aggregated agent metrics after policy update
 * - auto-register missing tools when backend validates policy references
 */

import { ApiError, OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });
const agentId = (process.env.ONCEONLY_AGENT_ID || "").trim() || "support-bot";
const toolName = (process.env.ONCEONLY_BUDGET_TOOL || "").trim() || "test_tool";
const toolBaseUrl = (process.env.ONCEONLY_TOOL_BASE_URL || "").trim().replace(/\/+$/, "") || "https://example.com/tools";
const toolSecret = (process.env.ONCEONLY_TOOL_SECRET || "").trim() || "example_secret_123";

async function ensureToolRegistered(name: string): Promise<void> {
  await client.gov.createTool({
    name,
    url: `${toolBaseUrl}/${encodeURIComponent(name)}`,
    scope_id: "global",
    auth: { type: "hmac_sha256", secret: toolSecret },
    timeout_ms: 15000,
    max_retries: 2,
    enabled: true,
    description: "Auto-registered by examples/ai/budget_limits.ts"
  });
  console.log(`  - ensured tool: ${name}`);
}

async function main() {
  const policyPayload = {
    agent_id: agentId,
    max_actions_per_hour: 5,
    max_spend_usd_per_day: 1,
    allowed_tools: [toolName],
    max_calls_per_tool: { [toolName]: 2 }
  };

  console.log("Setting strict budget policy...");
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
        : [toolName];
      for (const name of names) {
        await ensureToolRegistered(name);
      }
      await client.gov.upsertPolicy(policyPayload);
    } else {
      throw err;
    }
  }

  console.log("Policy set.");
  try {
    console.log("Metrics:", await client.gov.agentMetrics(agentId));
  } catch (err) {
    if (err instanceof ApiError) {
      console.log("Metrics unavailable right now:", {
        status_code: err.statusCode,
        detail: err.detail,
        message: err.message
      });
      console.log(
        "Policy was still applied. If needed, check /v1/agents/{agent_id}/metrics backend readiness " +
          "(plan entitlement, DB migrations, or observability table availability)."
      );
    } else {
      throw err;
    }
  }

  console.log("Attempting to exceed limits (simulate)...");
  console.log("When limits are exceeded, API will return OverLimitError or 402.");
}

void main();
