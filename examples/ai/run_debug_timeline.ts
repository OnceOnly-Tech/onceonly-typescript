/**
 * Example: inspect run timeline (debug logs) from SDK.
 *
 * What this demonstrates:
 * - start/attach AI run with explicit runId
 * - send a custom debug event (postEvent)
 * - fetch and print run timeline (getRunTimeline)
 */

import { randomUUID } from "node:crypto";
import { OnceOnly } from "../../src/index.js";

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

async function printTimeline(runId: string, limit = 100): Promise<number> {
  const timeline = await client.getRunTimeline(runId, limit, 0);
  const events = asEvents(timeline.events);
  const total = Number(timeline.total ?? 0);

  console.log(`\nrun_id=${String(timeline.run_id ?? runId)} total=${total} fetched=${events.length}`);
  for (const ev of events) {
    console.log(
      `- ts=${String(ev.ts)} type=${String(ev.type)} status=${String(ev.status)} ` +
        `step=${String(ev.step)} tool=${String(ev.tool)} message=${String(ev.message)}`
    );
  }
  return total;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function makeRunId(): string {
  return `run_demo_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

async function main() {
  const envRunId = (process.env.ONCEONLY_RUN_ID || "").trim();
  const envKey = (process.env.ONCEONLY_RUN_KEY || "").trim();

  const runId = envRunId || makeRunId();
  let key = `ai:job:debug:${runId}`;

  if (envRunId && envKey) {
    key = envKey;
  } else if (envRunId && !envKey) {
    key = `ai:job:debug:${runId}`;
  } else if (!envRunId && envKey) {
    console.log(
      "Warning: ONCEONLY_RUN_KEY is set without ONCEONLY_RUN_ID. " +
        "Ignoring ONCEONLY_RUN_KEY to avoid mismatched run context."
    );
  }

  const waitSeconds = Math.max(1, Number(process.env.ONCEONLY_WAIT_SECONDS ?? 12));
  const pollMs = Math.max(250, Number(process.env.ONCEONLY_POLL_MS ?? 1000));

  const eventResp = await client.postEvent({
    runId,
    type: "sdk_debug",
    status: "start",
    message: "run debug demo started from sdk"
  });
  console.log("postEvent:", eventResp);

  const run = await client.aiRun({
    key,
    ttl: 300,
    metadata: { task: "debug_timeline_demo", agent_id: "default" },
    runId
  });

  if ("status" in run && "key" in run) {
    console.log("aiRun:", {
      status: run.status,
      key: run.key,
      lease_id: "leaseId" in run ? run.leaseId : undefined,
      version: "version" in run ? run.version : undefined
    });
  } else {
    console.log("aiRun:", run);
  }

  let lastStatus = "in_progress";
  let total = 0;
  const startedAt = Date.now();
  while ((Date.now() - startedAt) / 1000 < waitSeconds) {
    await sleep(pollMs);
    try {
      const st = await client.ai.status(key);
      lastStatus = st.status;
      const timeline = await client.getRunTimeline(runId, 100, 0);
      total = Number(timeline.total ?? 0);
    } catch {
      // best-effort polling for demo mode
      continue;
    }

    if (lastStatus === "completed" || lastStatus === "failed") {
      break;
    }
  }

  await printTimeline(runId, 100);
  console.log("aiStatus:", lastStatus);
  if (total <= 1) {
    console.log(
      "\nOnly the custom sdk_debug event is present.\n" +
        "This usually means the background AI worker is not processing this run yet " +
        "(queue/worker configuration issue or delayed execution).\n" +
        `Waited ${waitSeconds}s with polling ${pollMs}ms.`
    );
    if ("status" in run && run.status === "completed") {
      console.log(
        "Note: aiRun returned completed, but timeline has only sdk_debug. " +
          "This can happen when key/run_id are from different run contexts."
      );
    }
  }
  console.log(
    "\nTip: to attach to the same run, set env vars:\n" +
      `  ONCEONLY_RUN_ID=${runId}\n` +
      `  ONCEONLY_RUN_KEY=${key}\n` +
      "and rerun the script."
  );
}

void main();
