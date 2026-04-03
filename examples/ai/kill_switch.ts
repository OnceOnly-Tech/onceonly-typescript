/**
 * Agent kill-switch example.
 *
 * What this shows:
 * - disable agent in emergency
 * - re-enable agent when operations can resume
 */

import { OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });
const agentId = process.env.ONCEONLY_AGENT_ID || "billing-agent";
const disableReason = process.env.ONCEONLY_DISABLE_REASON || "manual safety stop (example)";

async function main() {
  console.log("=== OnceOnly Kill Switch Demo ===");
  console.log("agent_id:", agentId);

  console.log("\nStep 1: Disable agent");
  console.log("Meaning: new governed tool calls for this agent should be blocked.");
  const disabled = await client.gov.disableAgent(agentId, disableReason);
  console.log("status:", {
    is_enabled: disabled.isEnabled,
    disabled_reason: disabled.disabledReason,
    disabled_at: disabled.disabledAt
  });

  console.log("\nStep 2: Re-enable agent");
  console.log("Meaning: governed tool calls can resume.");
  const enabled = await client.gov.enableAgent(agentId, "resume operations (example)");
  console.log("status:", {
    is_enabled: enabled.isEnabled,
    disabled_reason: enabled.disabledReason ?? null,
    disabled_at: enabled.disabledAt ?? null
  });

  console.log("\nDone.");
}

void main();
