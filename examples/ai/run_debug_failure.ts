/**
 * Example: debug a failed/blocked run with run timeline.
 *
 * Why this is useful:
 * - you get a stable runId for support/debug
 * - timeline shows where and why execution failed or was blocked
 */

import { ApiError, OnceOnly } from "../../src/index.js";

const apiKey = process.env.ONCEONLY_API_KEY;
if (!apiKey) throw new Error("Set ONCEONLY_API_KEY");

const client = new OnceOnly({ apiKey });

type TimelineEvent = {
  ts?: number;
  type?: string;
  status?: string;
  step?: string;
  tool?: string;
  message?: string;
};

function asEvents(value: unknown): TimelineEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((x) => x && typeof x === "object") as TimelineEvent[];
}

async function printTimeline(runId: string, limit = 100): Promise<void> {
  const timeline = await client.getRunTimeline(runId, limit, 0);
  const events = asEvents(timeline.events);
  console.log(`\nrun_id=${String(timeline.run_id ?? runId)} total=${String(timeline.total)} fetched=${events.length}`);
  for (const ev of events) {
    console.log(
      `- ts=${String(ev.ts)} type=${String(ev.type)} status=${String(ev.status)} ` +
        `step=${String(ev.step)} tool=${String(ev.tool)} message=${String(ev.message)}`
    );
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const ts = Math.floor(Date.now() / 1000);
  const runId = (process.env.ONCEONLY_RUN_ID || "").trim() || `run_fail_demo_${ts}`;
  const agentId = (process.env.ONCEONLY_AGENT_ID || "").trim() || "debug-agent";
  const tool = (process.env.ONCEONLY_TOOL || "").trim() || "this_tool_must_not_exist";

  console.log(`Starting failure demo: run_id=${runId} agent_id=${agentId} tool=${tool}`);

  const marker = await client.postEvent({
    runId,
    type: "sdk_debug",
    status: "start",
    message: "run debug failure demo started"
  });
  console.log("postEvent:", marker);

  try {
    const out = await client.ai.run({
      agentId,
      tool,
      args: { order_id: "ord_demo_1" },
      runId,
      spendUsd: 0.01
    });
    console.log("aiRun result:", out);
  } catch (err) {
    if (err instanceof ApiError) {
      console.error("aiRun ApiError:", {
        statusCode: err.statusCode,
        detail: err.detail,
        message: err.message
      });
    } else {
      throw err;
    }
  }

  await sleep(1000);
  await printTimeline(runId);
  console.log(
    "\nLook for `tool_result` and `run_finished` events.\n" +
      "They contain the failure/block reason used for debugging."
  );
}

void main();
