import {IAggregateSnapshot, IEventStore} from './store-types';
import {Uuid} from './utility-types';
import {IVersionedMessage} from './message-types';
import {OptimisticLockError} from './OptimisticLockError';

/**
 * An {@link IEventStore} implementation that stores events in memory.
 */
export class MemoryEventStore implements IEventStore {

  /**
   * The map from the aggregate name to a map of event streams by aggregate ID.
   */
  protected eventStreams = new Map<string, Map<Uuid, Array<IVersionedMessage>>>();

  /**
   * The map from the aggregate name to a map of snapshots by aggregate ID.
   */
  protected snapshots = new Map<string, Map<Uuid, IAggregateSnapshot>>();

  public async exists(name: string, id: Uuid): Promise<boolean> {
    return this.eventStreams.get(name)?.get(id) != null || this.snapshots.get(name)?.get(id) != null;
  }

  public async loadSnapshot(name: string, id: string): Promise<IAggregateSnapshot<any> | undefined> {
    return this.snapshots.get(name)?.get(id);
  }

  public async saveSnapshot(name: string, snapshot: IAggregateSnapshot): Promise<void> {
    let snapshots = this.snapshots.get(name);

    if (!snapshots) {
      snapshots = new Map();
      this.snapshots.set(name, snapshots);
    }

    const latestSnapshot = snapshots.get(snapshot.id);

    if (latestSnapshot && latestSnapshot.version > snapshot.version) {
      throw new OptimisticLockError(name);
    }
    snapshots.set(snapshot.id, snapshot);
  }

  public async dropSnapshot(name: string, id: string, version: bigint): Promise<void> {
    const snapshots = this.snapshots.get(name);

    if (snapshots?.get(id)?.version === version) {
      snapshots.delete(id);
    }
  }

  public async* loadEvents(name: string, id: Uuid, baseVersion?: bigint): AsyncIterable<IVersionedMessage> {
    const eventStream = this.eventStreams.get(name)?.get(id);

    if (!eventStream) {
      return;
    }
    if (baseVersion == null) {
      yield* eventStream;
      return;
    }
    for (const event of eventStream) {
      if (event.version > baseVersion) {
        yield event;
      }
    }
  }

  public async saveEvents(name: string, snapshot: IAggregateSnapshot, events: Array<IVersionedMessage>): Promise<void> {
    if (events.length === 0) {
      return;
    }

    let eventStreams = this.eventStreams.get(name);

    if (!eventStreams) {
      eventStreams = new Map();
      this.eventStreams.set(name, eventStreams);
    }

    const eventStream = eventStreams.get(snapshot.id);

    if (!eventStream) {
      eventStreams.set(snapshot.id, events.slice(0));
      return;
    }

    if (eventStream.length !== 0 && eventStream[eventStream.length - 1].version !== snapshot.version) {
      throw new OptimisticLockError(name);
    }
    eventStream.push(...events);
  }
}
