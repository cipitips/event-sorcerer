import {IAggregateSnapshot, IEventStore, IRepository} from './store-types';
import {IAggregatableAgent} from './agent-types';
import {Uuid} from './utility-types';
import {IStatefulHandler} from './handler-types';
import {IVersionedMessage} from './message-types';

/**
 * The basic implementation of {@link IRepository} that loads aggregates from an {@link IEventStore}.
 */
export class Repository implements IRepository {

  /**
   * The {@link IEventStore} that is used by the repository to load event streams and snapshots.
   */
  protected eventStore;

  constructor(eventStore: IEventStore) {
    this.eventStore = eventStore;
  }

  public exists(agent: IAggregatableAgent, id: Uuid): Promise<boolean> {
    return this.eventStore.exists(agent.name, id);
  }

  public async load<Agent extends IAggregatableAgent<State, Handler>, State, Handler extends IStatefulHandler<State>>(agent: Agent, handler: Handler, id: Uuid): Promise<Readonly<IAggregateSnapshot<State>>> {
    const latestSnapshot = await this.eventStore.loadSnapshot(agent.name, id);

    const snapshot: IAggregateSnapshot<State> = latestSnapshot || {
      id,
      version: 0n,
      state: handler.createInitialState(),
    };

    const eventStream = this.eventStore.loadEvents(agent.name, id, latestSnapshot?.version);

    for await (const event of eventStream) {
      agent.applyEvent(handler, event, snapshot.state);
      snapshot.version = event.version;
    }

    return snapshot;
  }

  public save<Agent extends IAggregatableAgent<State>, State>(agent: Agent, snapshot: Readonly<IAggregateSnapshot<State>>, events: Array<IVersionedMessage>): Promise<void> {
    return this.eventStore.saveEvents(agent.name, snapshot, events);
  }
}
