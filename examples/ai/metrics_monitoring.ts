/**
 * Agent metrics monitoring example.
 *
 * What this shows:
 * - read total actions, blocked actions, and spend for an agent
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });
const agentId = process.env.ONCEONLY_AGENT_ID || "billing-agent";
const periodRaw = (process.env.ONCEONLY_METRICS_PERIOD || "day").trim().toLowerCase();
const period: "hour" | "day" | "week" =
  periodRaw === "hour" || periodRaw === "week" ? periodRaw : "day";

async function main() {
  console.log("=== OnceOnly Metrics Monitoring ===");
  console.log("agent_id:", agentId);
  console.log("period:", period);

  const metrics = await client.gov.agentMetrics(agentId, period);
  console.log("\nMetrics summary:");
  console.log("  total_actions:", metrics.totalActions);
  console.log("  blocked_actions:", metrics.blockedActions);
  console.log("  total_spend_usd:", metrics.totalSpendUsd);

  console.log("\nTop tools:");
  if (!metrics.topTools.length) {
    console.log("  (none)");
  } else {
    for (const [i, tool] of metrics.topTools.entries()) {
      const t = String((tool as { tool?: unknown }).tool ?? "unknown");
      const c = Number((tool as { count?: unknown }).count ?? 0);
      console.log(`  ${i + 1}. ${t} (count=${c})`);
    }
  }

  console.log("\nRaw payload:");
  console.log(JSON.stringify(metrics.raw, null, 2));
}

void main();
