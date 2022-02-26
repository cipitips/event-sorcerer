import {Uuid} from './utility-types';
import {IVersionedMessage} from './message-types';
import {IEventStore, ISnapshot} from './event-store-types';

/**
 * A repository that loads and saves aggregates as streams of events read from the {@link IEventStore}.
 */
export class IAggregateRepository<State> {

  /**
   * The {@link IEventStore} that is used by the repository to load event streams and snapshots.
   */
  protected eventStore;

  constructor(eventStore: IEventStore) {
    this.eventStore = eventStore;
  }

  public load(id: Uuid): Promise<Readonly<ISnapshot<State>>> {

  }

  public save(snapshot: Readonly<ISnapshot<State>>, events: Array<IVersionedMessage>): Promise<void> {

  }
}
