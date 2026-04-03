/**
 * Example: LLM agent flow WITHOUT OnceOnly.
 *
 * This intentionally shows how retries/crashes can cause:
 * - duplicate tool calls
 * - double charges
 * - inconsistent state
 *
 * Run this file twice or simulate a retry to see duplicates.
 */

const toolEndpoint = (process.env.TOOL_ENDPOINT || "").trim();
const retryMode = (process.env.EXAMPLE_RETRY_MODE || "always").trim().toLowerCase(); // always | random | never

function validateToolEndpoint(url: string): void {
  if (!url) {
    throw new Error("Set TOOL_ENDPOINT env var, e.g. TOOL_ENDPOINT=https://httpbin.org/post");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid TOOL_ENDPOINT. Use full URL, e.g. TOOL_ENDPOINT=https://httpbin.org/post");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid TOOL_ENDPOINT protocol. Use http or https.");
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "example.com" || host === "www.example.com") {
    throw new Error(
      "TOOL_ENDPOINT points to placeholder domain. Set a real endpoint, e.g. TOOL_ENDPOINT=https://httpbin.org/post"
    );
  }
}

function shouldSimulateRetry(mode: string): boolean {
  if (mode === "always") return true;
  if (mode === "random") return Math.random() < 0.5;
  if (mode === "never") return false;
  throw new Error("Invalid EXAMPLE_RETRY_MODE. Use: always | random | never");
}

function llmDecide(): { tool: string; args: { amount: number; currency: string; user_id: string } } {
  return { tool: "stripe.charge", args: { amount: 9999, currency: "usd", user_id: "u_42" } };
}

async function callTool(payload: Record<string, unknown>): Promise<unknown> {
  const resp = await fetch(toolEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  return resp.json();
}

function summarizeToolResult(result: unknown, payload: { tool: string; args: Record<string, unknown> }): Record<string, unknown> {
  // httpbin echoes transport fields (headers, origin, etc.); keep only core payload echo.
  if (result && typeof result === "object" && !Array.isArray(result) && "json" in result) {
    const echoed = (result as Record<string, unknown>).json;
    if (echoed && typeof echoed === "object" && !Array.isArray(echoed)) {
      const e = echoed as Record<string, unknown>;
      return {
        tool: e.tool ?? payload.tool,
        args: e.args ?? payload.args,
        status: "ok"
      };
    }
  }
  return { status: "ok", result };
}

async function main(): Promise<void> {
  validateToolEndpoint(toolEndpoint);
  const simulateRetry = shouldSimulateRetry(retryMode);

  const decision = llmDecide();
  const payload = { tool: decision.tool, args: decision.args };
  let callsSent = 0;

  try {
    if (simulateRetry) {
      console.log("Simulated retry: sending same tool call again...");
      const retryResult = await callTool(payload);
      callsSent += 1;
      console.log(`Tool result (call #${callsSent}):`, summarizeToolResult(retryResult, payload));
    } else {
      console.log(`No retry simulated this run (EXAMPLE_RETRY_MODE=${retryMode}).`);
    }

    const result = await callTool(payload);
    callsSent += 1;
    console.log(`Tool result (call #${callsSent}):`, summarizeToolResult(result, payload));
    console.log(`Total tool calls sent without OnceOnly: ${callsSent}`);
    if (callsSent > 1) {
      console.log("Duplicate side-effect risk: same payload was sent multiple times.");
    } else {
      console.log("Single call this run. A retry/crash could still cause duplicates later.");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      "Tool call failed. Check TOOL_ENDPOINT reachability/TLS and try again. " +
        `Current TOOL_ENDPOINT=${toolEndpoint} | error=${msg}`
    );
  }
}

void main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  console.error(
    "Example: TOOL_ENDPOINT=https://httpbin.org/post npx tsx examples/ai/agent_full_flow_no_onceonly.ts"
  );
  process.exitCode = 1;
});
