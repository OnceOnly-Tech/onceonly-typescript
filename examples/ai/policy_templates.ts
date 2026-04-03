/**
 * Policy template example.
 *
 * What this shows:
 * - create policy from backend template
 * - apply local overrides on top of template defaults
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });
const agentId = (process.env.ONCEONLY_AGENT_ID || "").trim() || "support-bot";
const template = (process.env.ONCEONLY_POLICY_TEMPLATE || "").trim() || "moderate";
const maxActionsPerHour = Number.parseInt(process.env.ONCEONLY_MAX_ACTIONS_PER_HOUR || "120", 10) || 120;

async function main() {
  console.log("=== OnceOnly Policy Templates Demo ===");
  console.log("agent_id:", agentId);
  console.log("template:", template);
  console.log("override.max_actions_per_hour:", maxActionsPerHour);

  const policy = await client.gov.policyFromTemplate(agentId, template, {
    max_actions_per_hour: maxActionsPerHour
  });

  console.log("\nPolicy applied from template.");
  console.log("effective policy:", policy.policy);
  console.log("\nRaw payload:");
  console.log(JSON.stringify(policy.raw, null, 2));
}

void main();
