import { createHash } from "node:crypto";

import type { OnceOnly } from "./client.js";
import type { AiResult, MetadataLike } from "./types.js";

function truncate(text: string, maxLen = 2048): string {
  return text.length <= maxLen ? text : `${text.slice(0, maxLen)}...`;
}

function defaultJson(value: unknown): string {
  try {
    return JSON.stringify(value, Object.keys((value ?? {}) as Record<string, unknown>).sort());
  } catch {
    return truncate(String(value));
  }
}

function stableHash(payload: unknown): string {
  const raw = JSON.stringify(payload);
  return createHash("sha256").update(raw).digest("hex");
}

function generateKey(
  fnName: string,
  args: unknown[],
  kwargs: Record<string, unknown>,
  keyVersion: string,
  keyId?: string
): string {
  const fnId = keyId ?? fnName;
  const payload = {
    v: String(keyVersion),
    fn: fnId,
    args: args.map((a) => defaultJson(a)),
    kwargs: Object.fromEntries(
      Object.entries(kwargs)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, defaultJson(v)])
    )
  };
  return stableHash(payload);
}

export interface IdempotentOptions<TArgs extends unknown[], TResult> {
  keyPrefix?: string;
  ttl?: number;
  keyFn?: (...args: TArgs) => string;
  keyVersion?: string;
  keyId?: string;
  onDuplicate?: (...args: TArgs) => TResult | Promise<TResult>;
  returnValueOnDuplicate?: TResult;
}

export function idempotent<TArgs extends unknown[], TResult>(
  client: OnceOnly,
  fn: (...args: TArgs) => TResult | Promise<TResult>,
  opts: IdempotentOptions<TArgs, TResult> = {}
): (...args: TArgs) => Promise<TResult> {
  const keyPrefix = opts.keyPrefix ?? "func";
  const ttl = Number(opts.ttl ?? 86400);
  const keyVersion = opts.keyVersion ?? "v1";

  return async (...args: TArgs): Promise<TResult> => {
    const key =
      opts.keyFn?.(...args) ??
      generateKey(fn.name || "anonymous", args, {}, keyVersion, opts.keyId);

    const fullKey = `${keyPrefix}:${key}`;
    const lock = await client.checkLock({ key: fullKey, ttl });

    if (lock.duplicate) {
      if (opts.onDuplicate) {
        return opts.onDuplicate(...args);
      }
      return opts.returnValueOnDuplicate as TResult;
    }

    return fn(...args);
  };
}

export interface IdempotentAiOptions<TArgs extends unknown[]> {
  key?: string;
  keyFn?: (...args: TArgs) => string;
  ttl?: number;
  metadata?: MetadataLike;
  metadataFn?: (...args: TArgs) => MetadataLike;
  extendEvery?: number;
  waitOnConflict?: boolean;
  timeout?: number;
  pollMin?: number;
  pollMax?: number;
  errorCode?: string;
}

export function idempotentAi<TArgs extends unknown[]>(
  client: OnceOnly,
  fn: (...args: TArgs) => unknown | Promise<unknown>,
  opts: IdempotentAiOptions<TArgs> = {}
): (...args: TArgs) => Promise<AiResult> {
  if (!opts.key && !opts.keyFn) {
    throw new Error("idempotentAi requires either key or keyFn");
  }

  return async (...args: TArgs): Promise<AiResult> => {
    const key = String(opts.key ?? opts.keyFn?.(...args));
    const metadata = opts.metadataFn ? opts.metadataFn(...args) : opts.metadata;

    return client.ai.runFn(
      key,
      async () => fn(...args),
      {
        ttl: Number(opts.ttl ?? 300),
        metadata,
        extendEvery: Number(opts.extendEvery ?? 30),
        waitOnConflict: opts.waitOnConflict ?? true,
        timeout: Number(opts.timeout ?? 60),
        pollMin: Number(opts.pollMin ?? 0.5),
        pollMax: Number(opts.pollMax ?? 5),
        errorCode: String(opts.errorCode ?? "fn_error")
      }
    );
  };
}
