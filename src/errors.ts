export class OnceOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnceOnlyError";
  }
}

export class UnauthorizedError extends OnceOnlyError {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class OverLimitError extends OnceOnlyError {
  public readonly detail: Record<string, unknown>;

  constructor(message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = "OverLimitError";
    this.detail = detail;
  }
}

export class RateLimitError extends OnceOnlyError {
  public readonly retryAfterSec?: number;

  constructor(message: string, retryAfterSec?: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

export class ValidationError extends OnceOnlyError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ApiError extends OnceOnlyError {
  public readonly statusCode?: number;
  public readonly detail: Record<string, unknown>;

  constructor(message: string, opts: { statusCode?: number; detail?: Record<string, unknown> } = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = opts.statusCode;
    this.detail = opts.detail ?? {};
  }
}
