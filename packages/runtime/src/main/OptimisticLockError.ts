/**
 * An error that is thrown whenever an optimistic concurrency exception happens during aggregate persistence.
 */
export class OptimisticLockError extends Error {

  public aggregateName;

  /**
   * Creates a new {@link OptimisticLockError} instance.
   *
   * @param aggregateName The name of the aggregate that couldn't be persisted.
   */
  constructor(aggregateName: string) {
    super();
    this.name = 'OptimisticLockError';
    this.aggregateName = aggregateName;
  }
}
