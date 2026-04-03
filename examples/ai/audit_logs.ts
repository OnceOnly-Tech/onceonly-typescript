/**
 * Governance audit logs example.
 *
 * What this shows:
 * - fetch latest agent decisions/actions
 * - inspect decision reason and policy context
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });
const agentId = process.env.ONCEONLY_AGENT_ID || "billing-agent";
const limit = Math.max(1, Number.parseInt(process.env.ONCEONLY_LOG_LIMIT || "20", 10) || 20);

async function main() {
  console.log("=== OnceOnly Agent Audit Logs ===");
  console.log("agent_id:", agentId);
  console.log("limit:", limit);

  const logs = await client.gov.agentLogs(agentId, limit);
  console.log("\nLogs fetched:", logs.length);
  for (const row of logs.slice(0, 5)) {
    console.log({
      ts: row.ts,
      tool: row.tool,
      decision: row.decision,
      reason: row.policyReason || row.reason,
      args_hash: row.argsHash,
      risk_level: row.riskLevel,
      spend_usd: row.spendUsd
    });
  }

  if (logs.length === 0) {
    console.log(
      "\nNo logs yet. Run governance/tool examples first (tool_permissions, budget_limits, governance) " +
        "to generate audit records."
    );
  }
}

void main();
