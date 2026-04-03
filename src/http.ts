import fetch from "cross-fetch";

import { ApiError, OverLimitError, RateLimitError, UnauthorizedError, ValidationError } from "./errors.js";
import type { JsonMap } from "./types.js";

export interface RequestOptions {
  method: "GET" | "POST" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface HttpTransportOptions {
  baseUrl: string;
  timeoutMs: number;
  headers: Record<string, string>;
  maxRetries429: number;
  retryBackoffSec: number;
  retryMaxBackoffSec: number;
  fetchImpl?: typeof globalThis.fetch;
}

export interface HttpResponse {
  status: number;
  headers: Headers;
  text: string;
  json: unknown;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class HttpTransport {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly headers: Record<string, string>;
  private readonly maxRetries429: number;
  private readonly retryBackoffSec: number;
  private readonly retryMaxBackoffSec: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(opts: HttpTransportOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = Number(opts.timeoutMs);
    this.headers = { ...opts.headers };
    this.maxRetries429 = Number(opts.maxRetries429);
    this.retryBackoffSec = Number(opts.retryBackoffSec);
    this.retryMaxBackoffSec = Number(opts.retryMaxBackoffSec);
    this.fetchImpl = opts.fetchImpl ?? (fetch as unknown as typeof globalThis.fetch);
  }

  async request(opts: RequestOptions): Promise<HttpResponse> {
    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(1, this.timeoutMs));

      const url = this.buildUrl(opts.path, opts.query);
      const mergedHeaders = { ...this.headers, ...(opts.headers ?? {}) };
      const init: RequestInit = {
        method: opts.method,
        headers: mergedHeaders,
        signal: opts.signal ?? controller.signal
      };

      if (opts.body !== undefined) {
        init.body = JSON.stringify(opts.body);
      }

      try {
        const resp = await this.fetchImpl(url, init);
        clearTimeout(timeout);
        const text = await resp.text();
        let json: unknown = undefined;
        if (text.trim().length > 0) {
          try {
            json = JSON.parse(text);
          } catch {
            json = undefined;
          }
        }

        if (!RETRYABLE_STATUS.has(resp.status) || attempt >= this.maxRetries429) {
          return {
            status: resp.status,
            headers: resp.headers,
            text,
            json
          };
        }

        const retryAfter = parseRetryAfter(resp.headers);
        const backoffSec =
          retryAfter ?? Math.min(this.retryMaxBackoffSec, this.retryBackoffSec * 2 ** attempt);
        attempt += 1;
        await delay(backoffSec);
      } catch (err) {
        clearTimeout(timeout);
        if (attempt >= this.maxRetries429) {
          throw err;
        }
        const backoffSec = Math.min(this.retryMaxBackoffSec, this.retryBackoffSec * 2 ** attempt);
        attempt += 1;
        await delay(backoffSec);
      }
    }
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) {
          continue;
        }
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }
}

function delay(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, seconds * 1000)));
}

export function parseRetryAfter(headers: Headers): number | undefined {
  const retryAfter = headers.get("Retry-After");
  if (!retryAfter) {
    return undefined;
  }
  const n = Number(retryAfter.trim());
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return n;
}

export function tryExtractDetail(resp: HttpResponse): unknown {
  if (resp.json && typeof resp.json === "object" && !Array.isArray(resp.json) && "detail" in (resp.json as JsonMap)) {
    return (resp.json as JsonMap).detail;
  }
  return resp.json;
}

export function errorText(resp: HttpResponse, defaultText: string): string {
  const detail = tryExtractDetail(resp);
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as JsonMap;
    const out = d.error ?? d.message;
    if (typeof out === "string" && out.trim()) {
      return out;
    }
  }
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  return defaultText;
}

function detailAsObject(detail: unknown): Record<string, unknown> {
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    return detail as Record<string, unknown>;
  }
  if (typeof detail === "string" && detail.trim()) {
    return { detail };
  }
  return {};
}

function isUnauthorized403(detail: unknown): boolean {
  if (typeof detail === "string") {
    const d = detail.trim().toLowerCase();
    return d === "forbidden" || d === "invalid api key" || d === "api key disabled";
  }

  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as JsonMap;
    const err = String(d.error ?? "").trim().toLowerCase();
    const msg = String(d.message ?? "").trim().toLowerCase();
    if (err === "invalid_api_key" || err === "api_key_disabled" || err === "forbidden") {
      return true;
    }
    if (msg === "invalid api key" || msg === "api key disabled" || msg === "forbidden") {
      return true;
    }
  }

  return false;
}

export function parseJsonOrRaise(resp: HttpResponse): JsonMap {
  if (resp.status === 401) {
    throw new UnauthorizedError(errorText(resp, "Invalid API Key (Unauthorized)."));
  }

  if (resp.status === 403) {
    const detail = tryExtractDetail(resp);
    if (detail && typeof detail === "object" && !Array.isArray(detail) && (detail as JsonMap).error === "feature_not_available") {
      throw new ApiError(errorText(resp, "Feature not available for this plan."), {
        statusCode: 403,
        detail: detail as JsonMap
      });
    }
    if (isUnauthorized403(detail)) {
      throw new UnauthorizedError(errorText(resp, "Invalid API Key (Unauthorized)."));
    }
    throw new ApiError(errorText(resp, "API Error (403)"), {
      statusCode: 403,
      detail: detailAsObject(detail)
    });
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

  if (resp.status < 200 || resp.status >= 300) {
    const detail = tryExtractDetail(resp);
    throw new ApiError(errorText(resp, `API Error (${resp.status})`), {
      statusCode: resp.status,
      detail: detailAsObject(detail)
    });
  }

  if (!resp.json) {
    return {};
  }
  if (resp.json && typeof resp.json === "object" && !Array.isArray(resp.json)) {
    return resp.json as JsonMap;
  }
  return { data: resp.json };
}
