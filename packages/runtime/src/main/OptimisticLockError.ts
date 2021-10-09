/**
 * An error that is thrown whenever an optimistic concurrency exception happens during aggregate persistence.
 */
export class OptimisticLockError extends Error {

  /**
   * The name of the agent that couldn't be persisted.
   */
  public agentName = '<unknown>';

  constructor() {
    super();
    this.name = 'OptimisticLockError';
  }
}
