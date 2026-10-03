/** Domain-level error codes shared by application and API layers. */
export type ErrorCode =
  'unauthenticated' | 'forbidden' | 'not_found' | 'validation' | 'conflict' | 'rate_limited';

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
