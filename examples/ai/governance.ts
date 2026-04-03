import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });
const agentId = process.env.ONCEONLY_AGENT_ID || "billing-agent";

const metricsPeriodRaw = (process.env.ONCEONLY_METRICS_PERIOD || "day").trim().toLowerCase();
const metricsPeriod: "hour" | "day" | "week" =
  metricsPeriodRaw === "hour" || metricsPeriodRaw === "week" ? metricsPeriodRaw : "day";
const logLimit = Math.max(1, Number.parseInt(process.env.ONCEONLY_LOG_LIMIT || "10", 10) || 10);

async function main() {
  console.log("=== OnceOnly Agent Governance Demo ===");
  console.log("agent_id:", agentId);

  console.log("\n--- Policy Setup (Budgets + Permissions) ---");
  const policy = await client.gov.upsertPolicy({
    agent_id: agentId,
    max_actions_per_hour: 200,
    max_spend_usd_per_day: 50.0,
    allowed_tools: ["stripe.charge", "send_email", "stripe.refund"],
    blocked_tools: ["delete_user"],
    max_calls_per_tool: {
      "stripe.charge": 3,
      send_email: 100
    }
  });
  console.log("Policy applied:", policy.agentId);

  console.log("\n--- Metrics Demo ---");
  const metrics = await client.gov.agentMetrics(agentId, metricsPeriod);
  console.log("Metrics:", metrics);

  console.log("\n--- Kill Switch Demo ---");
  console.log("Disabling agent...");
  const st1 = await client.gov.disableAgent(agentId, "Manual safety stop (example)");
  console.log("Status after disable:", st1);
  console.log("Agent disabled. Tool calls should now be blocked (ai.runTool -> allowed=false) until enabled.");

  console.log("Re-enabling agent...");
  const st2 = await client.gov.enableAgent(agentId, "Resume operations (example)");
  console.log("Status after enable:", st2);

  console.log("\n--- Action Audit Log Demo ---");
  const logs = await client.gov.agentLogs(agentId, logLimit);
  console.log("Logs fetched:", logs.length);
  for (const log of logs.slice(0, 5)) {
    console.log({
      ts: log.ts,
      tool: log.tool,
      decision: log.decision,
      reason: log.policyReason || log.reason,
      args_hash: log.argsHash,
      risk_level: log.riskLevel,
      spend_usd: log.spendUsd
    });
  }

  console.log("\nDone.");
}

void main();
