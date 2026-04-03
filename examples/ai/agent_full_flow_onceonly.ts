import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

function llmDecide(): { tool: string; args: { amount: number; currency: string; user_id: string } } {
  return { tool: "stripe.charge", args: { amount: 9999, currency: "usd", user_id: "u_42" } };
}

async function main(): Promise<void> {
  const agentId = "billing-agent";

  await client.gov.upsertPolicy({
    agent_id: agentId,
    max_actions_per_hour: 200,
    max_spend_usd_per_day: 50,
    allowed_tools: ["stripe.charge"],
    blocked_tools: ["delete_user"]
  });

  const decision = llmDecide();
  const out = await client.ai.runTool({
    agentId,
    tool: decision.tool,
    args: decision.args,
    spendUsd: 0.5
  });

  if (out.allowed) {
    console.log("Tool result:", out.result);
  } else {
    console.log("Blocked:", out.policyReason);
  }
}

void main();
