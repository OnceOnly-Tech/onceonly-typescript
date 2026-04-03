import { parseJsonOrRaise, type HttpTransport } from "./http.js";
import type { AiResult, AiRun, AiStatus, AiToolResult, JsonMap, MetadataLike } from "./types.js";
import { sleep, toMetadataObject, toResultObject } from "./util.js";

function normalizeRunId(runId?: string | null): string | undefined {
  if (runId == null) {
    return undefined;
  }
  const out = String(runId).trim();
  if (!out) {
    throw new Error("run_id must not be empty");
  }
  return out;
}

function asObject(value: unknown): JsonMap | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonMap;
  }
  return undefined;
}

function toAiRun(data: JsonMap): AiRun {
  return {
    ok: Boolean(data.ok ?? false),
    status: String(data.status ?? ""),
    key: String(data.key ?? ""),
    leaseId: typeof data.lease_id === "string" ? data.lease_id : undefined,
    version: Number(data.version ?? 0),
    ttl: typeof data.ttl === "number" ? data.ttl : undefined,
    ttlLeft: typeof data.ttl_left === "number" ? data.ttl_left : undefined,
    firstSeenAt: typeof data.first_seen_at === "string" ? data.first_seen_at : undefined,
    charged: typeof data.charged === "number" ? data.charged : undefined,
    usage: typeof data.usage === "number" ? data.usage : undefined,
    limit: typeof data.limit === "number" ? data.limit : undefined,
    retryAfterSec: typeof data.retry_after_sec === "number" ? data.retry_after_sec : undefined,
    doneAt: typeof data.done_at === "string" ? data.done_at : undefined,
    errorCode: typeof data.error_code === "string" ? data.error_code : undefined,
    resultHash: typeof data.result_hash === "string" ? data.result_hash : undefined,
    result: asObject(data.result)
  };
}

function toAiStatus(data: JsonMap): AiStatus {
  return {
    ok: Boolean(data.ok ?? false),
    status: String(data.status ?? ""),
    key: String(data.key ?? ""),
    leaseId: typeof data.lease_id === "string" ? data.lease_id : undefined,
    version: Number(data.version ?? 0),
    ttlLeft: typeof data.ttl_left === "number" ? data.ttl_left : undefined,
    firstSeenAt: typeof data.first_seen_at === "string" ? data.first_seen_at : undefined,
    doneAt: typeof data.done_at === "string" ? data.done_at : undefined,
    resultHash: typeof data.result_hash === "string" ? data.result_hash : undefined,
    errorCode: typeof data.error_code === "string" ? data.error_code : undefined,
    retryAfterSec: typeof data.retry_after_sec === "number" ? data.retry_after_sec : undefined
  };
}

function toAiResult(data: JsonMap): AiResult {
  return {
    ok: Boolean(data.ok ?? false),
    status: String(data.status ?? ""),
    key: String(data.key ?? ""),
    result: asObject(data.result),
    resultHash: typeof data.result_hash === "string" ? data.result_hash : undefined,
    errorCode: typeof data.error_code === "string" ? data.error_code : undefined,
    doneAt: typeof data.done_at === "string" ? data.done_at : undefined
  };
}

function toAiToolResult(data: JsonMap): AiToolResult {
  return {
    ok: Boolean(data.ok ?? false),
    allowed: Boolean(data.allowed ?? false),
    decision: String(data.decision ?? ""),
    policyReason: typeof data.policy_reason === "string" ? data.policy_reason : undefined,
    riskLevel: typeof data.risk_level === "string" ? data.risk_level : undefined,
    result: asObject(data.result)
  };
}

export interface AiRunOptions {
  key?: string;
  ttl?: number;
  metadata?: MetadataLike;
  agentId?: string;
  tool?: string;
  args?: JsonMap;
  spendUsd?: number;
  runId?: string;
}

export interface AiWaitOptions {
  timeout?: number;
  pollMin?: number;
  pollMax?: number;
  autoExtend?: boolean;
  extendEvery?: number;
  leaseId?: string;
  ttl?: number;
}

export interface AiRunAndWaitOptions extends AiRunOptions, AiWaitOptions {}

export interface AiRunFnOptions {
  ttl?: number;
  metadata?: MetadataLike;
  extendEvery?: number;
  waitOnConflict?: boolean;
  timeout?: number;
  pollMin?: number;
  pollMax?: number;
  errorCode?: string;
}

export class AiClient {
  private readonly http: HttpTransport;

  constructor(http: HttpTransport) {
    this.http = http;
  }

  async run(opts: AiRunOptions): Promise<AiRun | AiToolResult> {
    const runId = normalizeRunId(opts.runId);

    let payload: JsonMap;
    if (!opts.key) {
      if (!opts.agentId || !opts.tool) {
        throw new Error("ai.run requires key OR agentId and tool");
      }
      const callArgs = { ...(opts.args ?? {}) } as JsonMap;
      if (runId !== undefined) {
        callArgs.run_id = runId;
      }
      payload = {
        agent_id: String(opts.agentId),
        tool: String(opts.tool)
      };
      if (Object.keys(callArgs).length > 0) {
        payload.args = callArgs;
      }
      if (opts.spendUsd !== undefined) {
        payload.spend_usd = Number(opts.spendUsd);
      }
    } else {
      if (opts.agentId || opts.tool || opts.args || opts.spendUsd !== undefined) {
        throw new Error("ai.run: provide either key or agentId/tool, not both");
      }
      payload = { key: String(opts.key) };
      if (opts.ttl !== undefined) {
        payload.ttl = Number(opts.ttl);
      }
      let md = toMetadataObject(opts.metadata);
      if (runId !== undefined) {
        md = { ...(md ?? {}), run_id: runId };
      }
      if (md !== undefined) {
        payload.metadata = md;
      }
    }

    const resp = await this.http.request({
      method: "POST",
      path: "/ai/run",
      body: payload
    });
    const data = parseJsonOrRaise(resp);
    if ("allowed" in data || "decision" in data) {
      return toAiToolResult(data);
    }
    return toAiRun(data);
  }

  async runAsync(opts: AiRunOptions): Promise<AiRun | AiToolResult> {
    return this.run(opts);
  }

  async status(key: string): Promise<AiStatus> {
    const resp = await this.http.request({
      method: "GET",
      path: "/ai/status",
      query: { key }
    });
    return toAiStatus(parseJsonOrRaise(resp));
  }

  async statusAsync(key: string): Promise<AiStatus> {
    return this.status(key);
  }

  async result(key: string): Promise<AiResult> {
    const resp = await this.http.request({
      method: "GET",
      path: "/ai/result",
      query: { key }
    });
    return toAiResult(parseJsonOrRaise(resp));
  }

  async resultAsync(key: string): Promise<AiResult> {
    return this.result(key);
  }

  async wait(key: string, opts: AiWaitOptions = {}): Promise<AiResult> {
    const timeout = Number(opts.timeout ?? 60);
    const pollMin = Number(opts.pollMin ?? 0.5);
    const pollMax = Number(opts.pollMax ?? 5);
    const autoExtend = opts.autoExtend ?? true;
    const extendEvery = Number(opts.extendEvery ?? 30);
    const startedAt = Date.now();
    let lastExtendAt = 0;

    for (;;) {
      const st = await this.status(key);
      if (st.status === "completed" || st.status === "failed") {
        return this.result(key);
      }
      if ((Date.now() - startedAt) / 1000 >= timeout) {
        return {
          ok: false,
          status: "failed",
          key,
          errorCode: "timeout"
        };
      }

      if (autoExtend && opts.leaseId) {
        const nowSec = Date.now() / 1000;
        if (nowSec - lastExtendAt >= extendEvery) {
          try {
            await this.extend(key, opts.leaseId, opts.ttl);
          } catch {
            // best-effort heartbeat
          }
          lastExtendAt = nowSec;
        }
      }

      const sleepSeconds =
        typeof st.retryAfterSec === "number" ? st.retryAfterSec : pollMin;
      const bounded = Math.max(pollMin, Math.min(pollMax, Number(sleepSeconds)));
      await sleep(bounded * 1000);
    }
  }

  async waitAsync(key: string, opts: AiWaitOptions = {}): Promise<AiResult> {
    return this.wait(key, opts);
  }

  async runAndWait(opts: AiRunAndWaitOptions): Promise<AiResult | AiToolResult> {
    if (!opts.key && (opts.agentId || opts.tool)) {
      return this.run(opts);
    }
    if (!opts.key) {
      throw new Error("ai.runAndWait requires key OR agentId/tool for tool execution");
    }
    const run = (await this.run(opts)) as AiRun;
    return this.wait(opts.key, {
      timeout: opts.timeout,
      pollMin: opts.pollMin,
      pollMax: opts.pollMax,
      autoExtend: opts.autoExtend,
      extendEvery: opts.extendEvery,
      leaseId: run.leaseId,
      ttl: opts.ttl
    });
  }

  async runAndWaitAsync(opts: AiRunAndWaitOptions): Promise<AiResult | AiToolResult> {
    return this.runAndWait(opts);
  }

  async runTool(opts: {
    agentId: string;
    tool: string;
    args?: JsonMap;
    spendUsd?: number;
    runId?: string;
  }): Promise<AiToolResult> {
    return (await this.run({
      agentId: opts.agentId,
      tool: opts.tool,
      args: opts.args,
      spendUsd: opts.spendUsd,
      runId: opts.runId
    })) as AiToolResult;
  }

  async runToolAsync(opts: {
    agentId: string;
    tool: string;
    args?: JsonMap;
    spendUsd?: number;
    runId?: string;
  }): Promise<AiToolResult> {
    return this.runTool(opts);
  }

  async runFn<T>(
    key: string,
    fn: () => T | Promise<T>,
    opts: AiRunFnOptions = {}
  ): Promise<AiResult> {
    const ttl = Number(opts.ttl ?? 300);
    const lease = await this.lease(key, ttl, opts.metadata);
    const status = String(lease.status ?? "").toLowerCase();

    if (status === "acquired") {
      const leaseId = typeof lease.lease_id === "string" ? lease.lease_id : undefined;
      if (!leaseId) {
        return { ok: false, status: "failed", key, errorCode: "missing_lease_id" };
      }

      const intervalMs = Math.max(1000, Math.floor(Number(opts.extendEvery ?? 30) * 1000));
      const timer = setInterval(() => {
        void this.extend(key, leaseId, ttl).catch(() => undefined);
      }, intervalMs);

      try {
        const output = await fn();
        await this.complete(key, leaseId, toResultObject(output));
      } catch (err) {
        try {
          await this.fail(key, leaseId, String(opts.errorCode ?? "fn_error"));
        } catch {
          // ignore best-effort fail marker errors
        }
        throw err;
      } finally {
        clearInterval(timer);
      }
      return this.result(key);
    }

    if (status === "completed" || status === "failed") {
      return this.result(key);
    }

    if (opts.waitOnConflict ?? true) {
      return this.wait(key, {
        timeout: Number(opts.timeout ?? 60),
        pollMin: Number(opts.pollMin ?? 0.5),
        pollMax: Number(opts.pollMax ?? 5)
      });
    }

    return {
      ok: false,
      status: status || "in_progress",
      key,
      errorCode: "not_acquired"
    };
  }

  async runFnAsync<T>(
    key: string,
    fn: () => T | Promise<T>,
    opts: AiRunFnOptions = {}
  ): Promise<AiResult> {
    return this.runFn(key, fn, opts);
  }

  async lease(key: string, ttl?: number, metadata?: MetadataLike): Promise<JsonMap> {
    const payload: JsonMap = { key };
    if (ttl !== undefined) {
      payload.ttl = Number(ttl);
    }
    const md = toMetadataObject(metadata);
    if (md !== undefined) {
      payload.metadata = md;
    }

    const resp = await this.http.request({ method: "POST", path: "/ai/lease", body: payload });
    return parseJsonOrRaise(resp);
  }

  async leaseAsync(key: string, ttl?: number, metadata?: MetadataLike): Promise<JsonMap> {
    return this.lease(key, ttl, metadata);
  }

  async extend(key: string, leaseId: string, ttl?: number): Promise<JsonMap> {
    const payload: JsonMap = { key, lease_id: leaseId };
    if (ttl !== undefined) {
      payload.ttl = Number(ttl);
    }
    const resp = await this.http.request({ method: "POST", path: "/ai/extend", body: payload });
    return parseJsonOrRaise(resp);
  }

  async extendAsync(key: string, leaseId: string, ttl?: number): Promise<JsonMap> {
    return this.extend(key, leaseId, ttl);
  }

  async complete(
    key: string,
    leaseId: string,
    result?: JsonMap,
    resultHash?: string
  ): Promise<JsonMap> {
    const payload: JsonMap = { key, lease_id: leaseId };
    if (resultHash !== undefined) {
      payload.result_hash = resultHash;
    }
    if (result !== undefined) {
      payload.result = result;
    }
    const resp = await this.http.request({ method: "POST", path: "/ai/complete", body: payload });
    return parseJsonOrRaise(resp);
  }

  async completeAsync(
    key: string,
    leaseId: string,
    result?: JsonMap,
    resultHash?: string
  ): Promise<JsonMap> {
    return this.complete(key, leaseId, result, resultHash);
  }

  async fail(key: string, leaseId: string, errorCode: string, errorHash?: string): Promise<JsonMap> {
    const payload: JsonMap = {
      key,
      lease_id: leaseId,
      error_code: errorCode
    };
    if (errorHash !== undefined) {
      payload.error_hash = errorHash;
    }
    const resp = await this.http.request({ method: "POST", path: "/ai/fail", body: payload });
    return parseJsonOrRaise(resp);
  }

  async failAsync(key: string, leaseId: string, errorCode: string, errorHash?: string): Promise<JsonMap> {
    return this.fail(key, leaseId, errorCode, errorHash);
  }

  async cancel(key: string, leaseId: string, reason?: string): Promise<JsonMap> {
    const payload: JsonMap = { key, lease_id: leaseId };
    if (reason) {
      payload.reason = reason;
    }
    const resp = await this.http.request({ method: "POST", path: "/ai/cancel", body: payload });
    return parseJsonOrRaise(resp);
  }

  async cancelAsync(key: string, leaseId: string, reason?: string): Promise<JsonMap> {
    return this.cancel(key, leaseId, reason);
  }
}
