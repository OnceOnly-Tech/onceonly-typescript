# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [3.0.5] - 2026-04-03
- Initial public TypeScript SDK release at parity level with Python SDK `3.0.5`.

### Added
- Core API client methods:
  - `checkLock`, `usage`, `usageAll`, `events`, `metrics`, `me`
  - `postEvent` (`POST /v1/events`)
  - `getRunTimeline` (`GET /v1/runs/{run_id}`)
  - `updateNotifications` (`POST /v1/me/notifications`)
- AI API methods:
  - `ai.run`, `ai.status`, `ai.result`, `ai.wait`, `ai.runAndWait`
  - `ai.runTool`, `ai.runFn`
  - lease lifecycle helpers: `lease`, `extend`, `complete`, `fail`, `cancel`
- Governance API methods:
  - policy CRUD and templates
  - tools registry CRUD
  - kill switch (`disableAgent`, `enableAgent`, `agentStatus`)
  - audit logs and metrics
- Decorators:
  - `idempotent`
  - `idempotentAi`
- Full examples suite aligned with Python SDK flows:
  - general idempotency, metadata, TTL, decorators, fail-open, webhook dedup
  - AI run/poll/result/debug/failure flows
  - governance flows (policies, budgets, kill switch, metrics, audit logs)

### Changed
- `runId` propagation in high-level AI calls:
  - key mode: auto-injected into `metadata.run_id`
  - tool mode: auto-injected into `args.run_id`
- Error handling and typed mapping improved:
  - auth-related `403` -> `UnauthorizedError`
  - business `403` -> `ApiError`
  - support for fail-open behavior on network/request errors
- Debug examples improved with clearer output and troubleshooting hints.
- README and `examples/README.md` expanded to include feature availability, support sections, and full example coverage.

### Fixed
- Network/fetch error handling for fail-open demo/runtime behavior.
- Example consistency issues between Python and TypeScript outputs and naming.

### Tested
- Automated tests pass via:
  - `npm test`
- Includes coverage for:
  - AI run `runId` propagation
  - fail-open behavior
  - notifications payload mapping
  - governance mappings and typed errors
  - `postEvent` / `getRunTimeline`
