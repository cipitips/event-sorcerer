import {Awaitable, Many, Maybe, ReadonlyMany} from '@smikhalevski/stdlib';

export type Payload<Message extends IMessage> = Message['payload'];

/**
 * An alias for UUID, for documentation purposes.
 */
export type Uuid = string;

/**
 * An arbitrary message.
 */
export interface IMessage {
  type: string;
  payload: unknown;
}

/**
 * A message that was dispatched through a messaging system.
 */
export interface IDispatchedMessage extends IMessage {
  id: Uuid;

  /**
   * When the message was dispatched.
   */
  timestamp: number;

  /**
   * The ID assigned to the chain of events.
   */
  correlationId: Uuid;

  /**
   * The ID of the message that was the reason why this message was dispatched.
   */
  causationId: Uuid | null;
}

/**
 * A message that is aware of the optimistic concurrency.
 */
export interface IVersionedMessage extends IDispatchedMessage {
  version: bigint;
}

export interface IAggregateHandler<State = unknown> {

  /**
   * Creates the initial state of the aggregate.
   */
  createInitialState(): State;
}

/**
 * The stateful projection of events that can be altered with commands.
 */
export interface IAggregate<State = unknown, Handler extends IAggregateHandler<State> = IAggregateHandler<State>, Command extends IMessage = IMessage, Event extends IMessage = IMessage, Alert extends IMessage = IMessage> {

  /**
   * The unique name of an aggregate. This should be used by persistence for reading of an event stream.
   */
  name: string;

  /**
   * Returns `true` if the message is the command that can be handled by this aggregate.
   */
  isSupportedCommand(message: IMessage): message is Command;

  /**
   * Returns `true` if the message is the event that can be applied by this aggregate.
   */
  isSupportedEvent(message: IMessage): message is Event;

  /**
   * Returns the aggregate ID who's state should be used for `command` handling.
   */
  getAggregateId(command: Command): Uuid;

  /**
   * Invokes a method on `handler` that handles the command.
   *
   * Returns events that should modify the state of this aggregate through apply.
   */
  handleCommand(handler: Handler, command: Command, state: Readonly<State>): Awaitable<ReadonlyMany<Event | Alert>>;

  /**
   * Updates `state` with changes described by the `event`.
   */
  applyEvent(handler: Handler, event: Event, state: State): void;
}

/**
 * The stateful process manager that receives adopted events and produces commands.
 */
export interface IProcessManager<State = unknown, Handler extends IAggregateHandler<State> = IAggregateHandler<State>, Command extends IMessage = IMessage, Event extends IMessage = IMessage, Alert extends IMessage = IMessage, AdoptedCommand extends IMessage = IMessage, AdoptedEvent extends IMessage = IMessage> extends IAggregate<State, Handler, Command, Event, Alert> {

  /**
   * Returns `true` if the event can be handled by this process manager.
   */
  isAdoptedEvent(message: IMessage): message is AdoptedEvent;

  /**
   * Returns the aggregate ID who's state should be used for `message` handling.
   */
  getAggregateId(message: Command | AdoptedEvent): Uuid;

  /**
   * Invokes a method on `handler` that handles the event.
   *
   * @returns Commands that should be dispatched in response to the event.
   */
  handleAdoptedEvent(handler: Handler, event: AdoptedEvent, state: Readonly<State>): Awaitable<Maybe<ReadonlyMany<Command | AdoptedCommand>>>;
}

/**
 * The stateless listener that receives events and dispatches commands.
 */
export interface IEventListener<Handler = unknown, AdoptedCommand extends IMessage = IMessage, AdoptedEvent extends IMessage = IMessage> {

  /**
   * The unique name of the event listener.
   */
  name: string;

  /**
   * Returns `true` if the event can be handled by this event  listener.
   */
  isAdoptedEvent(message: IMessage): message is AdoptedEvent;

  /**
   * Invokes a method on `handler` that handles the event.
   *
   * @returns Commands that should be dispatched in response to the event.
   */
  handleAdoptedEvent(handler: Handler, event: AdoptedEvent): Awaitable<Maybe<ReadonlyMany<AdoptedCommand>>>;
}

/**
 * The service that can receive commands and respond with events. Services are mush like aggregates but their
 * implementation doesn't have to rely on event sourcing.
 */
export interface IService<Handler = unknown, Command extends IMessage = IMessage, Event extends IMessage = IMessage, Alert extends IMessage = IMessage> {

  /**
   * The unique name of the service.
   */
  name: string;

  /**
   * Returns `true` if the message is the command that can be handled by this service.
   */
  isSupportedCommand(message: IMessage): message is Command;

  /**
   * Invokes a method on `handler` that handles the command.
   */
  handleCommand(handler: Handler, command: Command): Awaitable<ReadonlyMany<Event | Alert>>;
}

/**
 * The snapshot of the aggregate state that was loaded from the repository.
 */
export interface IAggregateSnapshot<State = unknown> {

  /**
   * The ID of an aggregate.
   */
  id: Uuid;

  /**
   * The version of the state, used for optimistic locking.
   */
  version: bigint;

  /**
   * The state of an aggregate.
   */
  state: Readonly<State>;
}

/**
 * The loads and saves aggregates as streams of events.
 */
export interface IRepository {

  /**
   * Returns `true` if an aggregate with the given ID was saved in the past.
   */
  exists(aggregate: IAggregate, id: Uuid): Promise<boolean>;

  /**
   * Restores the state of an aggregate from the persistence layer.
   */
  load<A extends IAggregate<State, Handler>, State, Handler extends IAggregateHandler<State>>(aggregate: A, handler: Handler, id: Uuid): Promise<Readonly<IAggregateSnapshot<State>>>;

  /**
   * Persists events that were produced using the given snapshot.
   *
   * @param aggregate The aggregate for which events were dispatched.
   * @param snapshot The state from which events were derived.
   * @param events The events that were dispatched.
   */
  save<A extends IAggregate<State>, State>(aggregate: A, snapshot: Readonly<IAggregateSnapshot<State>>, events: Array<IVersionedMessage>): Promise<void>;
}

/**
 * The abstraction from the database.
 */
export interface IEventStore {

  /**
   * Returns `true` if an aggregate with the given ID has a snapshot or at least one event.
   */
  exists(name: string, id: Uuid): Promise<boolean>;

  /**
   * Returns the latest available snapshot for the given aggregate or `undefined` if there's no snapshot available.
   */
  loadSnapshot(name: string, id: string): Promise<IAggregateSnapshot | undefined>;

  /**
   * Saves a snapshot.
   *
   * @throws OptimisticLockError If saving an aggregate failed because of the optimistic locking.
   */
  saveSnapshot(name: string, snapshot: IAggregateSnapshot): Promise<void>;

  /**
   * Removes the snapshot for the aggregate if it is available.
   */
  dropSnapshot(name: string, id: string, version: bigint): Promise<void>;

  /**
   * Returns an iterator that yields events that were persisted for an aggregate with the given ID.
   *
   * @param name The name of the aggregate to load. Store may use different tables or even databases to store
   *     aggregates and `aggregateName` can be the storage lookup key.
   * @param id The ID of the aggregate for which events must be loaded.
   * @param baseVersion The aggregate version after which (exclusive) events should be loaded.
   */
  loadEvents(name: string, id: Uuid, baseVersion?: bigint): AsyncIterable<IVersionedMessage>;

  /**
   * Persists events for the aggregate in the event store.
   *
   * @throws OptimisticLockError If saving an aggregate failed because of the optimistic locking.
   */
  saveEvents(name: string, snapshot: IAggregateSnapshot, events: Array<IVersionedMessage>): Promise<void>;
}

/**
 * The message broker abstraction.
 */
export interface IMessageDispatcher {

  /**
   * Dispatches messages through the message broker.
   */
  dispatch(messages: Many<IDispatchedMessage>): Promise<void>;
}

export class OptimisticLockError extends Error {

  constructor() {
    super();
    this.name = 'OptimisticLockError';
  }
}
