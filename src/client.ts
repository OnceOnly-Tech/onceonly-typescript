import { AiClient, type AiRunAndWaitOptions, type AiRunOptions } from "./ai.js";
import { ApiError, OverLimitError, RateLimitError, UnauthorizedError, ValidationError } from "./errors.js";
import { errorText, parseJsonOrRaise, parseRetryAfter, tryExtractDetail, HttpTransport, type HttpResponse } from "./http.js";
import { GovernanceClient } from "./governance.js";
import { VERSION } from "./version.js";
import { CheckLockResult, type AiResult, type AiRun, type AiToolResult, type JsonMap, type MetadataLike } from "./types.js";
import { normalizeBaseUrl, toMetadataObject } from "./util.js";

export interface OnceOnlyOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  userAgent?: string;
  failOpen?: boolean;
  maxRetries429?: number;
  retryBackoffSec?: number;
  retryMaxBackoffSec?: number;
  fetchImpl?: typeof globalThis.fetch;
}

export interface CheckLockOptions {
  key: string;
  ttl?: number;
  meta?: MetadataLike;
  requestId?: string;
}

function isNetworkError(err: unknown): boolean {
  if (!err) {
    return false;
  }

  const stack: unknown[] = [err];
  const seen = new Set<unknown>();
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur || seen.has(cur)) {
      continue;
    }
    seen.add(cur);

    const m = cur as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      errno?: unknown;
      type?: unknown;
      cause?: unknown;
    };
    const name = String(m.name ?? "");
    const message = String(m.message ?? "");
    const code = String(m.code ?? m.errno ?? "").toLowerCase();
    const type = String(m.type ?? "").toLowerCase();
    const hay = `${name} ${message} ${code} ${type}`.toLowerCase();

    if (
      code === "econnrefused" ||
      code === "econnreset" ||
      code === "enotfound" ||
      code === "eai_again" ||
      code === "etimedout"
    ) {
      return true;
    }

    if (
      hay.includes("network") ||
      hay.includes("failed to fetch") ||
      hay.includes("fetcherror") ||
      hay.includes("request to ") ||
      hay.includes("socket hang up") ||
      hay.includes("certificate verify failed") ||
      hay.includes("self signed certificate") ||
      hay.includes("unable to verify the first certificate") ||
      hay.includes("unable to get local issuer certificate")
    ) {
      return true;
    }

    if (m.cause) {
      stack.push(m.cause);
    }
  }
  return false;
}

export class OnceOnly {
  public readonly apiKey: string;
  public readonly baseUrl: string;
  public readonly timeoutMs: number;
  public readonly failOpen: boolean;

  public readonly ai: AiClient;
  public readonly gov: GovernanceClient;

  private readonly headers: Record<string, string>;
  private readonly http: HttpTransport;

  constructor(opts: OnceOnlyOptions) {
    if (!opts.apiKey) {
      throw new Error("apiKey is required");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = normalizeBaseUrl(opts.baseUrl ?? "https://api.onceonly.tech/v1");
    this.timeoutMs = Number(opts.timeoutMs ?? 5000);
    this.failOpen = opts.failOpen ?? true;

    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": opts.userAgent ?? `onceonly-typescript-sdk/${VERSION}`
    };

    this.http = new HttpTransport({
      baseUrl: this.baseUrl,
      timeoutMs: this.timeoutMs,
      headers: this.headers,
      maxRetries429: Number(opts.maxRetries429 ?? 0),
      retryBackoffSec: Number(opts.retryBackoffSec ?? 0.5),
      retryMaxBackoffSec: Number(opts.retryMaxBackoffSec ?? 5.0),
      fetchImpl: opts.fetchImpl
    });

    this.ai = new AiClient(this.http);
    this.gov = new GovernanceClient(this.http);
  }

  async checkLock(opts: CheckLockOptions): Promise<CheckLockResult> {
    const payload = this.makePayload(opts.key, opts.ttl, opts.meta);
    const headers: Record<string, string> = {};
    if (opts.requestId) {
      headers["X-Request-Id"] = opts.requestId;
    }

    try {
      const resp = await this.http.request({
        method: "POST",
        path: "/check-lock",
        body: payload,
        headers
      });
      return this.parseCheckLockResponse(resp, opts.key, Number(opts.ttl ?? 0), opts.meta);
    } catch (err) {
      if (!this.failOpen) {
        throw err;
      }

      if (err instanceof ApiError && typeof err.statusCode === "number" && err.statusCode >= 500) {
        return this.failOpenResult("api_5xx", opts.key, Number(opts.ttl ?? 0), opts.meta);
      }

      if ((err as Error)?.name === "AbortError") {
        return this.failOpenResult("timeout", opts.key, Number(opts.ttl ?? 0), opts.meta);
      }
      if (isNetworkError(err)) {
        return this.failOpenResult("request_error", opts.key, Number(opts.ttl ?? 0), opts.meta);
      }
      throw err;
    }
  }

  async checkLockAsync(opts: CheckLockOptions): Promise<CheckLockResult> {
    return this.checkLock(opts);
  }

  async aiRun(opts: AiRunOptions): Promise<AiRun | AiToolResult> {
    return this.ai.run(opts);
  }

  async aiRunAsync(opts: AiRunOptions): Promise<AiRun | AiToolResult> {
    return this.aiRun(opts);
  }

  async aiRunAndWait(opts: AiRunAndWaitOptions): Promise<AiResult | AiToolResult> {
    return this.ai.runAndWait(opts);
  }

  async aiRunAndWaitAsync(opts: AiRunAndWaitOptions): Promise<AiResult | AiToolResult> {
    return this.aiRunAndWait(opts);
  }

  async me(): Promise<JsonMap> {
    const resp = await this.http.request({ method: "GET", path: "/me" });
    return parseJsonOrRaise(resp);
  }

  async meAsync(): Promise<JsonMap> {
    return this.me();
  }

  async updateNotifications(opts: {
    emailNotificationsEnabled?: boolean;
    toolErrorNotificationsEnabled?: boolean;
    runFailureNotificationsEnabled?: boolean;
  }): Promise<JsonMap> {
    const payload: JsonMap = {};
    if (opts.emailNotificationsEnabled !== undefined) {
      payload.email_notifications_enabled = Boolean(opts.emailNotificationsEnabled);
    }
    if (opts.toolErrorNotificationsEnabled !== undefined) {
      payload.tool_error_notifications_enabled = Boolean(opts.toolErrorNotificationsEnabled);
    }
    if (opts.runFailureNotificationsEnabled !== undefined) {
      payload.run_failure_notifications_enabled = Boolean(opts.runFailureNotificationsEnabled);
    }
    if (Object.keys(payload).length === 0) {
      throw new Error("updateNotifications requires at least one preference field");
    }
    const resp = await this.http.request({
      method: "POST",
      path: "/me/notifications",
      body: payload
    });
    return parseJsonOrRaise(resp);
  }

  async updateNotificationsAsync(opts: {
    emailNotificationsEnabled?: boolean;
    toolErrorNotificationsEnabled?: boolean;
    runFailureNotificationsEnabled?: boolean;
  }): Promise<JsonMap> {
    return this.updateNotifications(opts);
  }

  async usage(kind: string = "make"): Promise<JsonMap> {
    const resp = await this.http.request({ method: "GET", path: "/usage", query: { kind } });
    return parseJsonOrRaise(resp);
  }

  async usageAsync(kind: string = "make"): Promise<JsonMap> {
    return this.usage(kind);
  }

  async usageAll(): Promise<JsonMap> {
    const resp = await this.http.request({ method: "GET", path: "/usage/all" });
    return parseJsonOrRaise(resp);
  }

  async usageAllAsync(): Promise<JsonMap> {
    return this.usageAll();
  }

  async events(limit = 50, offset = 0): Promise<JsonMap> {
    const resp = await this.http.request({
      method: "GET",
      path: "/events",
      query: { limit, offset }
    });
    return parseJsonOrRaise(resp);
  }

  async eventsAsync(limit = 50, offset = 0): Promise<JsonMap> {
    return this.events(limit, offset);
  }

  async postEvent(opts: {
    runId: string;
    type: string;
    ts?: number;
    status?: string;
    durationMs?: number;
    step?: string;
    tool?: string;
    reqId?: string;
    leaseId?: string;
    agentId?: string;
    message?: string;
    data?: JsonMap;
    extra?: JsonMap;
  }): Promise<JsonMap> {
    const runId = String(opts.runId).trim();
    if (!runId) {
      throw new Error("run_id must not be empty");
    }
    const eventType = String(opts.type).trim();
    if (!eventType) {
      throw new Error("type must not be empty");
    }

    const payload: JsonMap = {
      run_id: runId,
      type: eventType
    };
    if (opts.ts !== undefined) payload.ts = Number(opts.ts);
    if (opts.status !== undefined) payload.status = String(opts.status);
    if (opts.durationMs !== undefined) payload.duration_ms = Number(opts.durationMs);
    if (opts.step !== undefined) payload.step = String(opts.step);
    if (opts.tool !== undefined) payload.tool = String(opts.tool);
    if (opts.reqId !== undefined) payload.req_id = String(opts.reqId);
    if (opts.leaseId !== undefined) payload.lease_id = String(opts.leaseId);
    if (opts.agentId !== undefined) payload.agent_id = String(opts.agentId);
    if (opts.message !== undefined) payload.message = String(opts.message);
    if (opts.data !== undefined) payload.data = { ...opts.data };
    if (opts.extra !== undefined) Object.assign(payload, opts.extra);

    const resp = await this.http.request({
      method: "POST",
      path: "/events",
      body: payload
    });
    return parseJsonOrRaise(resp);
  }

  async postEventAsync(opts: {
    runId: string;
    type: string;
    ts?: number;
    status?: string;
    durationMs?: number;
    step?: string;
    tool?: string;
    reqId?: string;
    leaseId?: string;
    agentId?: string;
    message?: string;
    data?: JsonMap;
    extra?: JsonMap;
  }): Promise<JsonMap> {
    return this.postEvent(opts);
  }

  async getRunTimeline(runId: string, limit = 200, offset = 0): Promise<JsonMap> {
    const normalized = String(runId).trim();
    if (!normalized) {
      throw new Error("run_id must not be empty");
    }
    const path = `/runs/${encodeURIComponent(normalized)}`;
    const resp = await this.http.request({
      method: "GET",
      path,
      query: { limit, offset }
    });
    return parseJsonOrRaise(resp);
  }

  async getRunTimelineAsync(runId: string, limit = 200, offset = 0): Promise<JsonMap> {
    return this.getRunTimeline(runId, limit, offset);
  }

  async metrics(fromDay: string, toDay: string): Promise<JsonMap> {
    const resp = await this.http.request({
      method: "GET",
      path: "/metrics",
      query: { from_day: fromDay, to_day: toDay }
    });
    return parseJsonOrRaise(resp);
  }

  async metricsAsync(fromDay: string, toDay: string): Promise<JsonMap> {
    return this.metrics(fromDay, toDay);
  }

  close(): void {
    // no-op for fetch-based transport
  }

  async aclose(): Promise<void> {
    // no-op for fetch-based transport
  }

  private makePayload(key: string, ttl?: number, meta?: MetadataLike): JsonMap {
    const payload: JsonMap = { key };
    if (ttl !== undefined) {
      payload.ttl = Number(ttl);
    }
    const md = toMetadataObject(meta);
    if (md !== undefined) {
      payload.metadata = md;
    }
    return payload;
  }

  private failOpenResult(reason: string, key: string, ttl: number, meta?: MetadataLike): CheckLockResult {
    const raw: JsonMap = { fail_open: true, reason };
    const md = toMetadataObject(meta);
    if (md !== undefined) {
      raw.metadata = md;
    }
    return new CheckLockResult({
      locked: true,
      duplicate: false,
      key,
      ttl,
      firstSeenAt: null,
      requestId: "fail-open",
      statusCode: 0,
      raw
    });
  }

  parseCheckLockResponse(resp: HttpResponse, fallbackKey: string, fallbackTtl: number, fallbackMeta?: MetadataLike): CheckLockResult {
    const requestId = resp.headers.get("X-Request-Id");
    const ooStatus = (resp.headers.get("X-OnceOnly-Status") ?? "").trim().toLowerCase();

    if (resp.status === 401 || resp.status === 403) {
      throw new UnauthorizedError(errorText(resp, "Invalid API Key (Unauthorized)."));
    }
    if (resp.status === 402) {
      const detail = tryExtractDetail(resp);
      throw new OverLimitError(
        "Usage limit reached. Please upgrade your plan.",
        detail && typeof detail === "object" && !Array.isArray(detail) ? (detail as JsonMap) : {}
      );
    }
    if (resp.status === 429) {
      throw new RateLimitError(errorText(resp, "Rate limit exceeded. Please slow down."), parseRetryAfter(resp.headers));
    }
    if (resp.status === 422) {
      throw new ValidationError(errorText(resp, `Validation Error: ${resp.text}`));
    }
    if (resp.status === 409) {
      const detail = tryExtractDetail(resp);
      let firstSeenAt: string | null = null;
      if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        const d = detail as JsonMap;
        firstSeenAt = typeof d.first_seen_at === "string" ? d.first_seen_at : null;
      }
      const raw: JsonMap = detail ? { detail } : {};
      const md = toMetadataObject(fallbackMeta);
      if (md !== undefined) {
        raw.metadata = md;
      }

      return new CheckLockResult({
        locked: false,
        duplicate: true,
        key: fallbackKey,
        ttl: fallbackTtl,
        firstSeenAt,
        requestId,
        statusCode: resp.status,
        raw
      });
    }
    if (resp.status < 200 || resp.status >= 300) {
      parseJsonOrRaise(resp);
      throw new ApiError("Unexpected non-2xx response", { statusCode: resp.status });
    }

    const data = parseJsonOrRaise(resp);
    const status = String(data.status ?? "").trim().toLowerCase();
    const success = Boolean(data.success);

    let locked: boolean;
    let duplicate: boolean;
    if (status === "locked" || status === "duplicate") {
      locked = status === "locked";
      duplicate = status === "duplicate";
    } else if (ooStatus === "locked" || ooStatus === "duplicate") {
      locked = ooStatus === "locked";
      duplicate = ooStatus === "duplicate";
    } else {
      locked = success;
      duplicate = !success;
    }

    const raw = { ...data };
    const md = toMetadataObject(fallbackMeta);
    if (md !== undefined && raw.metadata === undefined) {
      raw.metadata = md;
    }

    return new CheckLockResult({
      locked,
      duplicate,
      key: String(data.key ?? fallbackKey),
      ttl: Number(data.ttl ?? fallbackTtl),
      firstSeenAt: typeof data.first_seen_at === "string" ? data.first_seen_at : null,
      requestId,
      statusCode: resp.status,
      raw
    });
  }
}

export function createClient(opts: OnceOnlyOptions): OnceOnly {
  return new OnceOnly(opts);
}
