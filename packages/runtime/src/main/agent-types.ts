import {Awaitable, Maybe, ReadonlyMany, Uuid} from './utility-types';
import {IMessage} from './message-types';
import {IStatefulHandler} from './handler-types';

/**
 * An agent is a message processing unit that communicates with other agents via messages.
 */
export type Agent =
    | IAggregateAgent
    | IProcessManagerAgent
    | IEventListenerAgent
    | IServiceAgent
    | IMonitorAgent;

/**
 * Type of an agent.
 */
export const enum AgentType {
  AGGREGATE = 'aggregate',
  PROCESS_MANAGER = 'processManager',
  EVENT_LISTENER = 'eventListener',
  SERVICE = 'service',
  MONITOR = 'monitor',
}

/**
 * The agent that can receive or dispatch messages.
 */
export interface IAgent {

  /**
   * The type of an agent.
   */
  readonly type: AgentType;

  /**
   * The system-wide unique name of an agent that can be used by persistence or service discovery.
   */
  readonly name: string;
}

/**
 * The agent which state is rehydrated from an event stream.
 */
export interface IAggregatingAgent<State = unknown, Handler extends IStatefulHandler<State> = IStatefulHandler<State>, Command extends IMessage = IMessage, Event extends IMessage = IMessage, Alert extends IMessage = IMessage>
    extends IAgent {

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
   * @returns A `Promise` that is resolved after event is applied.
   */
  applyEvent(handler: Handler, event: Event, state: State): Awaitable<void>;
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
export interface IAggregateAgent<State = unknown, Handler extends IStatefulHandler<State> = IStatefulHandler<State>, Command extends IMessage = IMessage, Event extends IMessage = IMessage, Alert extends IMessage = IMessage>
    extends IAggregatingAgent<State, Handler, Command, Event, Alert> {

  type: AgentType.AGGREGATE;
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
export interface IProcessManagerAgent<State = unknown, Handler extends IStatefulHandler<State> = IStatefulHandler<State>, Command extends IMessage = IMessage, Event extends IMessage = IMessage, Alert extends IMessage = IMessage, AdoptedCommand extends IMessage = IMessage, AdoptedEvent extends IMessage = IMessage>
    extends IAggregatingAgent<State, Handler, Command, Event, Alert> {

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
export interface IEventListenerAgent<Handler = unknown, AdoptedCommand extends IMessage = IMessage, AdoptedEvent extends IMessage = IMessage>
    extends IAgent {

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
export interface IServiceAgent<Handler = unknown, Command extends IMessage = IMessage, Event extends IMessage = IMessage, Alert extends IMessage = IMessage>
    extends IAgent {

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
 * A monitor is an agent that handles alerts dispatched by other agents. Since alerts are ephemeral monitor agent may
 * implement telemetry or other functions that aren't business-related. Monitor is the only agent type that can adopt
 * alerts from other agents.
 *
 * @template Handler The handler that knows how to handle alerts.
 * @template Alert Alerts that monitor can handle.
 */
export interface IMonitorAgent<Handler = unknown, Alert extends IMessage = IMessage>
    extends IAgent {

  type: AgentType.MONITOR;

  /**
   * Checks that the message is the alert that can be handled by this monitor.
   *
   * @param message An incoming message.
   * @returns `true` if `message` is a command supported by the service.
   */
  isRecognizedAlert(message: IMessage): message is Alert;

  /**
   * Invokes a method on `handler` that handles the alert.
   *
   * @param handler The handler that knows how to handle alerts sent to a monitor.
   * @param alert The alert to handle.
   * @returns A `Promise` that is resolved after handling is completed.
   */
  handleAlert(handler: Handler, alert: Alert): Awaitable<void>;
}
