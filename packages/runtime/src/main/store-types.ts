import {Many, Uuid} from './utility-types';
import {IAggregatingAgent} from './agent-types';
import {IDispatchedMessage, IVersionedMessage} from './message-types';
import {IStatefulHandler} from './handler-types';

/**
 * A snapshot of the aggregate state that was loaded from the repository.
 *
 * @template State The aggregate state.
 */
export interface IAggregateSnapshot<State = unknown> {

  /**
   * The ID of an aggregate.
   */
  id: Uuid;

  /**
   * The version of the last event that was used during the assembly of the snapshot's state.
   */
  version: bigint;

  /**
   * The state of an aggregate.
   */
  state: Readonly<State>;
}

/**
 * A repository that loads and saves aggregates as streams of events.
 */
export interface IRepository {

  /**
   * Returns `true` if an aggregate with the given ID was saved in the past.
   */
  exists(agent: IAggregatingAgent, id: Uuid): Promise<boolean>;

  /**
   * Restores the state of an aggregate from the persistence layer.
   */
  load<Agent extends IAggregatingAgent<State, Handler>, State, Handler extends IStatefulHandler<State>>(agent: Agent, handler: Handler, id: Uuid): Promise<Readonly<IAggregateSnapshot<State>>>;

  /**
   * Persists events that were produced using the given snapshot.
   *
   * @param agent The aggregate for which events were dispatched.
   * @param snapshot The state from which events were derived.
   * @param events The events that were dispatched.
   */
  save<Agent extends IAggregatingAgent<State>, State>(agent: Agent, snapshot: Readonly<IAggregateSnapshot<State>>, events: Array<IVersionedMessage>): Promise<void>;
}

/**
 * An abstraction of an event-stream database.
 */
export interface IEventStore {

  /**
   * Returns `true` if an aggregate with the given ID has at least one event.
   *
   * @param name The name of the aggregate.
   * @param id The ID of the aggregate.
   */
  exists(name: string, id: Uuid): Promise<boolean>;

  /**
   * Returns the latest available snapshot for the given aggregate or `undefined` if there's no snapshot available.
   *
   * @param name The name of the aggregate.
   * @param id The ID of the aggregate.
   */
  loadSnapshot(name: string, id: Uuid): Promise<IAggregateSnapshot | undefined>;

  /**
   * Saves a snapshot.
   *
   * @param name The name of the aggregate.
   * @param snapshot The snapshot to save.
   *
   * @throws OptimisticLockError If saving an aggregate failed because of the optimistic locking.
   */
  saveSnapshot(name: string, snapshot: IAggregateSnapshot): Promise<void>;

  /**
   * Removes the snapshot for the aggregate if it is available.
   *
   * @param name The name of the aggregate.
   * @param id The ID of the aggregate.
   * @param version The snapshot version to drop.
   */
  dropSnapshot(name: string, id: Uuid, version: bigint): Promise<void>;

  /**
   * Returns an iterator that yields events that were persisted for an aggregate with the given ID.
   *
   * @param name The name of the aggregate to load. Store may use different tables or even databases to store
   *     aggregates and `name` can be the storage lookup key.
   * @param id The ID of the aggregate for which events must be loaded.
   * @param baseVersion The aggregate version after which (exclusive) events should be loaded. If omitted then all
   *     events are loaded.
   */
  loadEvents(name: string, id: Uuid, baseVersion?: bigint): AsyncIterable<IVersionedMessage>;

  /**
   * Persists events for the aggregate in the event store.
   *
   * @param name The name of the aggregate.
   * @param snapshot The snapshot to save.
   * @param events The list of events to save.
   *
   * @throws OptimisticLockError If saving an aggregate failed because of the optimistic locking.
   */
  saveEvents(name: string, snapshot: IAggregateSnapshot, events: Array<IVersionedMessage>): Promise<void>;
}

/**
 * A message broker abstraction.
 */
export interface IMessageDispatcher {

  /**
   * Dispatches messages through the message broker.
   */
  dispatch(messages: Many<IDispatchedMessage>): Promise<void>;
}
