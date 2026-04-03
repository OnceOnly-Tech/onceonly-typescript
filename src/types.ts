export type JsonMap = Record<string, unknown>;

export class CheckLockResult {
  public readonly locked: boolean;
  public readonly duplicate: boolean;
  public readonly key: string;
  public readonly ttl: number;
  public readonly firstSeenAt: string | null;
  public readonly requestId: string | null;
  public readonly statusCode: number;
  public readonly raw: JsonMap;

  constructor(init: {
    locked: boolean;
    duplicate: boolean;
    key: string;
    ttl: number;
    firstSeenAt?: string | null;
    requestId?: string | null;
    statusCode: number;
    raw?: JsonMap;
  }) {
    this.locked = Boolean(init.locked);
    this.duplicate = Boolean(init.duplicate);
    this.key = String(init.key);
    this.ttl = Number(init.ttl);
    this.firstSeenAt = init.firstSeenAt ?? null;
    this.requestId = init.requestId ?? null;
    this.statusCode = Number(init.statusCode);
    this.raw = init.raw ?? {};
  }

  shouldProceed(): boolean {
    return this.locked && !this.duplicate;
  }

  isDuplicate(): boolean {
    return this.duplicate;
  }
}

export interface Policy {
  agentId: string;
  policy: JsonMap;
  maxActionsPerHour?: number;
  maxSpendUsdPerDay?: number;
  allowedTools?: string[];
  blockedTools?: string[];
  maxCallsPerTool?: Record<string, number>;
  pricingRules?: JsonMap[];
  raw?: JsonMap;
}

export interface AgentStatus {
  agentId: string;
  isEnabled: boolean;
  disabledReason?: string;
  disabledAt?: string;
  raw?: JsonMap;
}

export interface AgentLogItem {
  ts: unknown;
  agentId: string;
  tool?: string;
  allowed: boolean;
  decision?: string;
  policyReason?: string;
  reason: string;
  argsHash?: string;
  riskLevel?: string;
  spendUsd: number;
  raw?: JsonMap;
}

export interface AgentMetrics {
  agentId: string;
  period: "hour" | "day" | "week";
  totalActions: number;
  blockedActions: number;
  totalSpendUsd: number;
  topTools: JsonMap[];
  raw?: JsonMap;
}

export interface AiRun {
  ok: boolean;
  status: string;
  key: string;
  leaseId?: string;
  version: number;
  ttl?: number;
  ttlLeft?: number;
  firstSeenAt?: string;
  charged?: number;
  usage?: number;
  limit?: number;
  retryAfterSec?: number;
  doneAt?: string;
  errorCode?: string;
  resultHash?: string;
  result?: JsonMap;
}

export interface AiStatus {
  ok: boolean;
  status: string;
  key: string;
  leaseId?: string;
  version: number;
  ttlLeft?: number;
  firstSeenAt?: string;
  doneAt?: string;
  resultHash?: string;
  errorCode?: string;
  retryAfterSec?: number;
}

export interface AiResult {
  ok: boolean;
  status: string;
  key: string;
  result?: JsonMap;
  resultHash?: string;
  errorCode?: string;
  doneAt?: string;
}

export interface AiToolResult {
  ok: boolean;
  allowed: boolean;
  decision: string;
  policyReason?: string;
  riskLevel?: string;
  result?: JsonMap;
}

export type MetadataLike =
  | JsonMap
  | null
  | undefined
  | {
      toJSON?: () => unknown;
      [key: string]: unknown;
    }
  | unknown;
