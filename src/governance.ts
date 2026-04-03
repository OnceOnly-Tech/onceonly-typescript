import { parseJsonOrRaise } from "./http.js";
import type { HttpTransport } from "./http.js";
import type { AgentLogItem, AgentMetrics, AgentStatus, JsonMap, Policy } from "./types.js";

function extractList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    const m = value as JsonMap;
    if (Array.isArray(m.items)) {
      return m.items;
    }
    if (Array.isArray(m.data)) {
      return m.data;
    }
  }
  return [];
}

function policyFromResponse(
  data: unknown,
  fallbackAgentId?: string,
  fallbackPolicy?: JsonMap
): Policy {
  const root = data && typeof data === "object" && !Array.isArray(data) ? (data as JsonMap) : {};
  const agentId = String(root.agent_id ?? fallbackAgentId ?? "");
  const nested = root.policy;
  const policy =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as JsonMap)
      : fallbackPolicy ?? root;

  return {
    agentId,
    policy,
    maxActionsPerHour: typeof policy.max_actions_per_hour === "number" ? policy.max_actions_per_hour : undefined,
    maxSpendUsdPerDay:
      typeof policy.max_spend_usd_per_day === "number" ? policy.max_spend_usd_per_day : undefined,
    allowedTools: Array.isArray(policy.allowed_tools) ? (policy.allowed_tools as string[]) : undefined,
    blockedTools: Array.isArray(policy.blocked_tools) ? (policy.blocked_tools as string[]) : undefined,
    maxCallsPerTool:
      policy.max_calls_per_tool && typeof policy.max_calls_per_tool === "object" && !Array.isArray(policy.max_calls_per_tool)
        ? (policy.max_calls_per_tool as Record<string, number>)
        : undefined,
    pricingRules: Array.isArray(policy.pricing_rules) ? (policy.pricing_rules as JsonMap[]) : undefined,
    raw: root
  };
}

export class GovernanceClient {
  private readonly http: HttpTransport;

  constructor(http: HttpTransport) {
    this.http = http;
  }

  async upsertPolicy(policy: JsonMap, agentId?: string): Promise<Policy> {
    const target = String(agentId ?? policy.agent_id ?? "").trim();
    if (!target) {
      throw new Error("upsertPolicy requires agentId");
    }

    const payload = { ...policy, agent_id: target };
    const resp = await this.http.request({
      method: "POST",
      path: `/policies/${encodeURIComponent(target)}`,
      body: payload
    });
    return policyFromResponse(parseJsonOrRaise(resp), target, payload);
  }

  async upsertPolicyAsync(policy: JsonMap, agentId?: string): Promise<Policy> {
    return this.upsertPolicy(policy, agentId);
  }

  async policyFromTemplate(agentId: string, template: string, overrides?: JsonMap): Promise<Policy> {
    const payload = {
      agent_id: agentId,
      template,
      overrides: overrides ?? {}
    };
    const resp = await this.http.request({
      method: "POST",
      path: `/policies/${encodeURIComponent(agentId)}/from-template`,
      body: payload
    });
    return policyFromResponse(parseJsonOrRaise(resp), agentId, payload);
  }

  async policyFromTemplateAsync(agentId: string, template: string, overrides?: JsonMap): Promise<Policy> {
    return this.policyFromTemplate(agentId, template, overrides);
  }

  async listPolicies(): Promise<Policy[]> {
    const resp = await this.http.request({ method: "GET", path: "/policies" });
    const data = parseJsonOrRaise(resp);
    return extractList(data).map((item) => policyFromResponse(item));
  }

  async listPoliciesAsync(): Promise<Policy[]> {
    return this.listPolicies();
  }

  async getPolicy(agentId: string): Promise<Policy> {
    const resp = await this.http.request({
      method: "GET",
      path: `/policies/${encodeURIComponent(agentId)}`
    });
    return policyFromResponse(parseJsonOrRaise(resp), agentId);
  }

  async getPolicyAsync(agentId: string): Promise<Policy> {
    return this.getPolicy(agentId);
  }

  async createTool(tool: JsonMap): Promise<JsonMap> {
    const resp = await this.http.request({
      method: "POST",
      path: "/tools",
      body: tool
    });
    return parseJsonOrRaise(resp);
  }

  async createToolAsync(tool: JsonMap): Promise<JsonMap> {
    return this.createTool(tool);
  }

  async listTools(scopeId = "global"): Promise<JsonMap[]> {
    const resp = await this.http.request({
      method: "GET",
      path: "/tools",
      query: { scope_id: scopeId }
    });
    const data = parseJsonOrRaise(resp);
    return extractList(data).filter((x) => x && typeof x === "object").map((x) => x as JsonMap);
  }

  async listToolsAsync(scopeId = "global"): Promise<JsonMap[]> {
    return this.listTools(scopeId);
  }

  async getTool(name: string, scopeId = "global"): Promise<JsonMap> {
    const resp = await this.http.request({
      method: "GET",
      path: `/tools/${encodeURIComponent(name)}`,
      query: { scope_id: scopeId }
    });
    return parseJsonOrRaise(resp);
  }

  async getToolAsync(name: string, scopeId = "global"): Promise<JsonMap> {
    return this.getTool(name, scopeId);
  }

  async toggleTool(name: string, enabled: boolean, scopeId = "global"): Promise<JsonMap> {
    const resp = await this.http.request({
      method: "POST",
      path: `/tools/${encodeURIComponent(name)}/toggle`,
      query: { scope_id: scopeId },
      body: { enabled: Boolean(enabled) }
    });
    return parseJsonOrRaise(resp);
  }

  async toggleToolAsync(name: string, enabled: boolean, scopeId = "global"): Promise<JsonMap> {
    return this.toggleTool(name, enabled, scopeId);
  }

  async deleteTool(name: string, scopeId = "global"): Promise<JsonMap> {
    const resp = await this.http.request({
      method: "DELETE",
      path: `/tools/${encodeURIComponent(name)}`,
      query: { scope_id: scopeId }
    });
    return parseJsonOrRaise(resp);
  }

  async deleteToolAsync(name: string, scopeId = "global"): Promise<JsonMap> {
    return this.deleteTool(name, scopeId);
  }

  async disableAgent(agentId: string, reason = ""): Promise<AgentStatus> {
    const resp = await this.http.request({
      method: "POST",
      path: `/agents/${encodeURIComponent(agentId)}/disable`,
      body: reason ? { reason } : {}
    });
    const data = parseJsonOrRaise(resp);
    return {
      agentId: String(data.agent_id ?? agentId),
      isEnabled: Boolean(data.is_enabled ?? data.enabled),
      disabledReason: typeof data.disabled_reason === "string" ? data.disabled_reason : undefined,
      disabledAt: typeof data.disabled_at === "string" ? data.disabled_at : undefined,
      raw: data
    };
  }

  async disableAgentAsync(agentId: string, reason = ""): Promise<AgentStatus> {
    return this.disableAgent(agentId, reason);
  }

  async enableAgent(agentId: string, reason = ""): Promise<AgentStatus> {
    const resp = await this.http.request({
      method: "POST",
      path: `/agents/${encodeURIComponent(agentId)}/enable`,
      body: reason ? { reason } : {}
    });
    const data = parseJsonOrRaise(resp);
    return {
      agentId: String(data.agent_id ?? agentId),
      isEnabled: Boolean(data.is_enabled ?? data.enabled),
      disabledReason: typeof data.disabled_reason === "string" ? data.disabled_reason : undefined,
      disabledAt: typeof data.disabled_at === "string" ? data.disabled_at : undefined,
      raw: data
    };
  }

  async enableAgentAsync(agentId: string, reason = ""): Promise<AgentStatus> {
    return this.enableAgent(agentId, reason);
  }

  async agentLogs(agentId: string, limit = 100): Promise<AgentLogItem[]> {
    const resp = await this.http.request({
      method: "GET",
      path: `/agents/${encodeURIComponent(agentId)}/logs`,
      query: { limit }
    });
    const data = parseJsonOrRaise(resp);
    return extractList(data).flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return [];
      }
      const row = item as JsonMap;
      const allowed = Boolean(row.allowed ?? true);
      const policyReason = typeof row.policy_reason === "string" ? row.policy_reason : String(row.reason ?? "");
      return [
        {
          ts: row.ts,
          agentId: String(row.agent_id ?? agentId),
          tool: typeof row.tool === "string" ? row.tool : undefined,
          allowed,
          decision: typeof row.decision === "string" ? row.decision : allowed ? "allowed" : "blocked",
          policyReason,
          reason: String(row.reason ?? policyReason ?? ""),
          argsHash: typeof row.args_hash === "string" ? row.args_hash : undefined,
          riskLevel: typeof row.risk_level === "string" ? row.risk_level : undefined,
          spendUsd: Number(row.spend_usd ?? 0),
          raw: row
        }
      ] as AgentLogItem[];
    });
  }

  async agentLogsAsync(agentId: string, limit = 100): Promise<AgentLogItem[]> {
    return this.agentLogs(agentId, limit);
  }

  async agentMetrics(agentId: string, period: "hour" | "day" | "week" = "day"): Promise<AgentMetrics> {
    const resp = await this.http.request({
      method: "GET",
      path: `/agents/${encodeURIComponent(agentId)}/metrics`,
      query: { period }
    });
    const data = parseJsonOrRaise(resp);
    return {
      agentId: String(data.agent_id ?? agentId),
      period: String(data.period ?? period) as "hour" | "day" | "week",
      totalActions: Number(data.total_actions ?? 0),
      blockedActions: Number(data.blocked_actions ?? 0),
      totalSpendUsd: Number(data.total_spend_usd ?? 0),
      topTools: Array.isArray(data.top_tools) ? (data.top_tools as JsonMap[]) : [],
      raw: data
    };
  }

  async agentMetricsAsync(agentId: string, period: "hour" | "day" | "week" = "day"): Promise<AgentMetrics> {
    return this.agentMetrics(agentId, period);
  }
}
