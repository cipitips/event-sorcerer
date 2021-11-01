import {IAggregateSnapshot, IEventStore, IRepository} from './store-types';
import {IAggregatingAgent} from './agent-types';
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

  public exists(agent: IAggregatingAgent, id: Uuid): Promise<boolean> {
    return this.eventStore.exists(agent.name, id);
  }

  public async load<Agent extends IAggregatingAgent<State, Handler>, State, Handler extends IStatefulHandler<State>>(agent: Agent, handler: Handler, id: Uuid): Promise<Readonly<IAggregateSnapshot<State>>> {
    const latestSnapshot = await this.eventStore.loadSnapshot(agent.name, id);

    const state = latestSnapshot?.state as State || handler.createInitialState();

    const snapshot: IAggregateSnapshot<State> = {
      id,
      version: latestSnapshot?.version || 0n,
      state,
    };

    const eventStream = this.eventStore.loadEvents(agent.name, id, latestSnapshot?.version);

    for await (const event of eventStream) {
      agent.applyEvent(handler, event, state);
      snapshot.version = event.version;
    }

    return snapshot;
  }

  public save<Agent extends IAggregatingAgent<State>, State>(agent: Agent, snapshot: Readonly<IAggregateSnapshot<State>>, events: Array<IVersionedMessage>): Promise<void> {
    return this.eventStore.saveEvents(agent.name, snapshot, events);
  }
}
