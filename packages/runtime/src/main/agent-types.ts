import {Awaitable, Maybe, ReadonlyMany, Uuid} from './utility-types';
import {IMessage} from './message-types';

/**
 * The agent that can receive or dispatch messages.
 */
export interface IAgent<Handler = unknown, State = unknown, Command extends IMessage = IMessage, Event extends IMessage = IMessage, Alert extends IMessage = IMessage, AdoptedCommand extends IMessage = IMessage, AdoptedEvent extends IMessage = IMessage, AdoptedAlert extends IMessage = IMessage> {

  /**
   * The system-wide unique name of an agent that can be used by persistence layer or in service discovery.
   */
  name: string;

  commandTypes?: ReadonlySet<string>;
  eventTypes?: ReadonlySet<string>;
  alertTypes?: ReadonlySet<string>;

  adoptedCommandMap?: ReadonlyMap<string, IAgent>;
  adoptedEventMap?: ReadonlyMap<string, IAgent>;
  adoptedAlertMap?: ReadonlyMap<string, IAgent>;

  /**
   * Returns the aggregate ID who's state should be used for message handling.
   *
   * @param message The incoming command or the adopted event.
   * @returns The ID of the aggregate to which the message must be applied.
   */
  getAggregateId?(message: Command | AdoptedEvent): Uuid;

  /**
   * Updates state with changes described by the event.
   *
   * @param handler The handler that knows how to apply aggregate events to the state.
   * @param event The event to apply to the state.
   * @param state The mutable state of the aggregate to which the event must be applied.
   * @returns A `Promise` that is resolved after event is applied.
   */
  applyEvent?(handler: Handler, event: Event, state: State): Awaitable<void>;

  /**
   * Invokes a method on the handler that handles the command.
   *
   * @param handler The handler that knows how to handle commands sent to an aggregate.
   * @param command The command to handle.
   * @param state The immutable state of the agent that should be used during command handling.
   * @returns Events that should be applied to the state of the aggregate or alerts to notify telemetry.
   */
  handleCommand?(handler: Handler, command: Command, state: State): Awaitable<ReadonlyMany<Event | Alert | AdoptedAlert>>;

  /**
   * Invokes a method on the handler that processes the adopted event.
   *
   * @param handler The handler that knows how to process adopted events.
   * @param event The adopted event to that must be processed.
   * @param state The immutable state of the agent that should be used during event processing.
   * @returns Commands that should be dispatched in response to the event.
   */
  handleEvent?(handler: Handler, event: AdoptedEvent, state: State): Awaitable<Maybe<ReadonlyMany<Command | Alert | AdoptedCommand | AdoptedAlert>>>;

  /**
   * Invokes a method on the handler that handles the alert.
   *
   * @param handler The handler that knows how to handle alerts sent to a monitor.
   * @param alert The alert to handle.
   * @param state The immutable state of the agent that should be used during event processing.
   * @returns A `Promise` that is resolved after handling is completed.
   */
  handleAlert?(handler: Handler, alert: Alert | AdoptedAlert, state: State): Awaitable<void>;
}
