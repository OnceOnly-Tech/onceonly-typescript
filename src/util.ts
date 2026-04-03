import type { JsonMap, MetadataLike } from "./types.js";

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = String(baseUrl).replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    if (!u.pathname || u.pathname === "/") {
      return `${trimmed}/v1`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

export function toMetadataObject(metadata?: MetadataLike): JsonMap | undefined {
  if (metadata == null) {
    return undefined;
  }

  if (typeof metadata === "object" && metadata !== null) {
    try {
      if (typeof (metadata as { toJSON?: () => unknown }).toJSON === "function") {
        const out = (metadata as { toJSON: () => unknown }).toJSON();
        if (out && typeof out === "object" && !Array.isArray(out)) {
          return out as JsonMap;
        }
        return { data: out };
      }
    } catch {
      return { value: String(metadata) };
    }

    if (!Array.isArray(metadata)) {
      try {
        return JSON.parse(JSON.stringify(metadata)) as JsonMap;
      } catch {
        return { value: String(metadata) };
      }
    }
  }

  return { value: String(metadata) };
}

export function toResultObject(value: unknown): JsonMap | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonMap;
  }
  try {
    return { value: String(value) };
  } catch {
    return { value: "<unserializable>" };
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parsePositiveInt(input: unknown, fallback: number): number {
  const n = Number(input);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(0, Math.floor(n));
}
