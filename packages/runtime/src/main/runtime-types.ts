import {Awaitable, Many, Maybe, ReadonlyMany} from './utility-types';

/**
 * An alias for UUID, for documentation purposes.
 */
export type Uuid = string;

/**
 * A message passed between agents.
 */
export interface IMessage {
  type: string;
  payload: unknown;
}

export const enum AgentType {
  AGGREGATE = 'aggregate',
  PROCESS_MANAGER = 'processManager',
  EVENT_LISTENER = 'eventListener',
  SERVICE = 'service',
}

/**
 * Recognized agents.
 */
export type Agent =
    | IAggregateAgent
    | IProcessManagerAgent
    | IEventListenerAgent
    | IServiceAgent;

/**
 * The system agent that can receive or dispatch messages.
 */
export interface IAgent {

  /**
   * The type of an agent.
   */
  type: AgentType;

  /**
   * The system-wide unique name of an agent that can be used by persistence or service discovery.
   */
  name: string;
}

/**
 * A message that was dispatched through a messaging system.
 */
export interface IDispatchedMessage extends IMessage {

  /**
   * The unique message ID.
   */
  id: Uuid;

  /**
   * The timestamp when the message was dispatched.
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

  /**
   * The monotonically ascending index of the message in scope of an event stream. Versioning allows solving optimistic
   * concurrency issues when updating aggregates.
   */
  version: bigint;
}

/**
 * A handler that knows how to handle commands and apply events.
 *
 * @template State The type of the aggregate state.
 */
export interface IAggregateHandler<State = unknown> {

  /**
   * Creates the initial state of the aggregate.
   */
  createInitialState(): State;
}

/**
 * A stateful projection of events that can be altered with commands.
 *
 * @template State The aggregate state.
 * @template Handler The handler that knows how to handle commands and apply events.
 * @template Command Commands that aggregate can handle.
 * @template Event Events that can be applied to the state of the aggregate.
 * @template Alert Alerts that aggregate can dispatch.
 */
export interface IAggregateAgent<State = unknown, Handler extends IAggregateHandler<State> = IAggregateHandler<State>, Command extends IMessage = IMessage, Event extends IMessage = IMessage, Alert extends IMessage = IMessage> extends IAgent {
  type: AgentType.AGGREGATE;

  /**
   * Checks that the message is the command that can be handled by this aggregate.
   *
   * @param message An incoming message.
   * @returns `true` if `message` is a command supported by the aggregate.
   */
  isSupportedCommand(message: IMessage): message is Command;

  /**
   * Checks that the message is the event that can be applied by this aggregate.
   *
   * @param message An incoming message.
   * @returns `true` if `message` is an event supported by the aggregate.
   */
  isSupportedEvent(message: IMessage): message is Event;

  /**
   * Returns the aggregate ID who's state should be used for `command` handling.
   *
   * @param command The incoming command.
   * @returns The ID of the aggregate to which the `command` must be applied.
   */
  getAggregateId(command: Command): Uuid;

  /**
   * Invokes a method on `handler` that handles the command.
   *
   * @param handler The handler that knows how to handle commands sent to an aggregate.
   * @param command The command to handle.
   * @param state The immutable state of the aggregate that should be used during command handling.
   * @returns Events that should be applied to the state of the aggregate or alerts to notify telemetry.
   */
  handleCommand(handler: Handler, command: Command, state: Readonly<State>): Awaitable<ReadonlyMany<Event | Alert>>;

  /**
   * Updates `state` with changes described by the `event`.
   *
   * @param handler The handler that knows how to apply aggregate events to the state.
   * @param event The event to apply to the state.
   * @param state The mutable state of the aggregate to which the event must be applied.
   */
  applyEvent(handler: Handler, event: Event, state: State): void;
}

/**
 * A stateful process manager that receives adopted events and produces commands.
 *
 * @template State The process manager state.
 * @template Handler The handler that knows how to handle commands and apply events.
 * @template Command Commands that process manager can handle.
 * @template Event Events that can be applied to the state of the process manager.
 * @template Alert Alerts that process manager can dispatch.
 * @template AdoptedCommand Commands adopted from other handlers that this process manager notices.
 * @template AdoptedEvent Events adopted from other handlers that this process manager can dispatch.
 */
export interface IProcessManagerAgent<State = unknown, Handler extends IAggregateHandler<State> = IAggregateHandler<State>, Command extends IMessage = IMessage, Event extends IMessage = IMessage, Alert extends IMessage = IMessage, AdoptedCommand extends IMessage = IMessage, AdoptedEvent extends IMessage = IMessage> extends Omit<IAggregateAgent<State, Handler, Command, Event, Alert>, 'type'> {
  type: AgentType.PROCESS_MANAGER;

  /**
   * Checks that the event can be handled by this process manager.
   *
   * @param message An incoming message.
   * @returns `true` if `message` is an event from another handler adopted by the process manager.
   */
  isAdoptedEvent(message: IMessage): message is AdoptedEvent;

  /**
   * Returns the aggregate ID who's state should be used for `message` handling.
   *
   * @param message The incoming command or the adopted event.
   * @returns The ID of the aggregate to which the `command` must be applied.
   */
  getAggregateId(message: Command | AdoptedEvent): Uuid;

  /**
   * Invokes a method on `handler` that processes the event.
   *
   * @param handler The handler that knows how to process adopted events.
   * @param event The adopted event to that must be processed.
   * @param state The immutable state of the process manager that should be used during event processing.
   * @returns Commands that should be dispatched in response to the event.
   */
  handleAdoptedEvent(handler: Handler, event: AdoptedEvent, state: Readonly<State>): Awaitable<Maybe<ReadonlyMany<Command | AdoptedCommand>>>;
}

/**
 * A stateless listener that receives events and dispatches commands.
 *
 * @template Handler The handler that knows how to handle commands and apply events.
 * @template AdoptedCommand Commands adopted from other handlers that this event listener notices.
 * @template AdoptedEvent Events adopted from other handlers that this event listener can dispatch.
 */
export interface IEventListenerAgent<Handler = unknown, AdoptedCommand extends IMessage = IMessage, AdoptedEvent extends IMessage = IMessage> extends IAgent {
  type: AgentType.EVENT_LISTENER;

  /**
   * Checks that the event can be handled by this event listener.
   *
   * @param message An incoming message.
   * @returns `true` if `message` is an event from another handler adopted by the process manager.
   */
  isAdoptedEvent(message: IMessage): message is AdoptedEvent;

  /**
   * Invokes a method on `handler` that handles the event.
   *
   * @param handler The handler that knows how to process adopted events.
   * @param event The adopted event to that must be processed.
   * @returns Commands that should be dispatched in response to the event.
   */
  handleAdoptedEvent(handler: Handler, event: AdoptedEvent): Awaitable<Maybe<ReadonlyMany<AdoptedCommand>>>;
}

/**
 * A service that can receive commands and respond with events. Services are much like aggregates but their
 * implementation doesn't have to rely on event sourcing.
 *
 * @template Handler The handler that knows how to handle commands and apply events.
 * @template Command Commands that service can handle.
 * @template Event Events that service can dispatch.
 * @template Alert Alerts that service can dispatch.
 */
export interface IServiceAgent<Handler = unknown, Command extends IMessage = IMessage, Event extends IMessage = IMessage, Alert extends IMessage = IMessage> extends IAgent {
  type: AgentType.SERVICE;

  /**
   * Checks that the message is the command that can be handled by this service.
   *
   * @param message An incoming message.
   * @returns `true` if `message` is a command supported by the service.
   */
  isSupportedCommand(message: IMessage): message is Command;

  /**
   * Invokes a method on `handler` that handles the command.
   *
   * @param handler The handler that knows how to handle commands sent to a service.
   * @param command The command to handle.
   * @returns Events that should be dispatched or alerts to notify telemetry.
   */
  handleCommand(handler: Handler, command: Command): Awaitable<ReadonlyMany<Event | Alert>>;
}

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
  exists(aggregate: IAggregateAgent, id: Uuid): Promise<boolean>;

  /**
   * Restores the state of an aggregate from the persistence layer.
   */
  load<Aggregate extends IAggregateAgent<State, Handler>, State, Handler extends IAggregateHandler<State>>(aggregate: Aggregate, handler: Handler, id: Uuid): Promise<Readonly<IAggregateSnapshot<State>>>;

  /**
   * Persists events that were produced using the given snapshot.
   *
   * @param aggregate The aggregate for which events were dispatched.
   * @param snapshot The state from which events were derived.
   * @param events The events that were dispatched.
   */
  save<Aggregate extends IAggregateAgent<State>, State>(aggregate: Aggregate, snapshot: Readonly<IAggregateSnapshot<State>>, events: Array<IVersionedMessage>): Promise<void>;
}

/**
 * An abstraction from the database.
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
 * A message broker abstraction.
 */
export interface IMessageDispatcher {

  /**
   * Dispatches messages through the message broker.
   */
  dispatch(messages: Many<IDispatchedMessage>): Promise<void>;
}
