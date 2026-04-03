export { VERSION } from "./version.js";

export { OnceOnly, createClient } from "./client.js";
export { AiClient } from "./ai.js";
export { GovernanceClient } from "./governance.js";

export { idempotent, idempotentAi } from "./decorators.js";

export {
  OnceOnlyError,
  UnauthorizedError,
  OverLimitError,
  RateLimitError,
  ValidationError,
  ApiError
} from "./errors.js";

export type {
  JsonMap,
  MetadataLike,
  CheckLockResult as CheckLockResultType,
  Policy,
  AgentStatus,
  AgentLogItem,
  AgentMetrics,
  AiRun,
  AiStatus,
  AiResult,
  AiToolResult
} from "./types.js";

export { CheckLockResult } from "./types.js";
