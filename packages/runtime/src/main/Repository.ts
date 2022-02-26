import {ISnapshot, IEventStore} from './event-store-types';
import {Uuid} from './utility-types';
import {IStatefulHandler} from './handler-types';
import {IVersionedMessage} from './message-types';
import {IAgent} from './agent-types';

/**
 * The repository that loads aggregates from an {@link IEventStore}.
 */
export class Repository {

  /**
   * The {@link IEventStore} that is used by the repository to load event streams and snapshots.
   */
  protected eventStore;

  constructor(eventStore: IEventStore) {
    this.eventStore = eventStore;
  }

  public async load<Agent extends IAgent<Handler, State>, State, Handler extends IStatefulHandler<State>>(agent: Agent, handler: Handler, id: Uuid): Promise<Readonly<ISnapshot<State>>> {
    const latestSnapshot = await this.eventStore.loadSnapshot(agent.name, id);

    const snapshot: ISnapshot<State> = latestSnapshot || {
      id,
      version: 0n,
      state: handler.createInitialState(),
    };

    const eventStream = this.eventStore.loadEvents(agent.name, id, latestSnapshot?.version);

    for await (const event of eventStream) {
      agent.applyEvent?.(handler, event, snapshot.state);
      snapshot.version = event.version;
    }

    return snapshot;
  }

  public save<Agent extends IAgent<unknown, State>, State>(agent: Agent, snapshot: Readonly<ISnapshot<State>>, events: Array<IVersionedMessage>): Promise<void> {
    return this.eventStore.saveEvents(agent.name, snapshot, events);
  }
}
