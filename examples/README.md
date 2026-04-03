# OnceOnly TypeScript SDK — Examples

These examples mirror Python SDK coverage, adapted for TypeScript async APIs.

## Setup

```bash
npm install
export ONCEONLY_API_KEY="once_live_..."
```

## Start Here

- [`quickstart.ts`](./quickstart.ts)

## General

- [`general/basic_check_lock.ts`](./general/basic_check_lock.ts)
- [`general/webhook_dedup.ts`](./general/webhook_dedup.ts)
- [`general/with_ttl.ts`](./general/with_ttl.ts)
- [`general/with_metadata.ts`](./general/with_metadata.ts)
- [`general/usage_stats.ts`](./general/usage_stats.ts)
- [`general/fail_open_demo.ts`](./general/fail_open_demo.ts)
- [`general/decorator_basic.ts`](./general/decorator_basic.ts)
- [`general/decorator_sync.ts`](./general/decorator_sync.ts)
- [`general/decorator_async.ts`](./general/decorator_async.ts)

## AI / Governance

- [`ai/ai_simple.ts`](./ai/ai_simple.ts)
- [`ai/run_and_wait.ts`](./ai/run_and_wait.ts)
- [`ai/poll_status.ts`](./ai/poll_status.ts)
- [`ai/get_result.ts`](./ai/get_result.ts)
- [`ai/run_debug_timeline.ts`](./ai/run_debug_timeline.ts)
- [`ai/run_debug_failure.ts`](./ai/run_debug_failure.ts)
- [`ai/agent_action_local.ts`](./ai/agent_action_local.ts)
- [`ai/governance.ts`](./ai/governance.ts)
- [`ai/tool_permissions.ts`](./ai/tool_permissions.ts)
- [`ai/budget_limits.ts`](./ai/budget_limits.ts)
- [`ai/policy_templates.ts`](./ai/policy_templates.ts)
- [`ai/kill_switch.ts`](./ai/kill_switch.ts)
- [`ai/audit_logs.ts`](./ai/audit_logs.ts)
- [`ai/metrics_monitoring.ts`](./ai/metrics_monitoring.ts)
- [`ai/agent_full_flow_no_onceonly.ts`](./ai/agent_full_flow_no_onceonly.ts)
- [`ai/agent_full_flow_onceonly.ts`](./ai/agent_full_flow_onceonly.ts)
- [`ai/langchain_tool_ai_lease.ts`](./ai/langchain_tool_ai_lease.ts)

## Run

Use built-in npm example scripts:

```bash
npm run example:basic
npm run example:debug:timeline
npm run example:debug:failure
```
