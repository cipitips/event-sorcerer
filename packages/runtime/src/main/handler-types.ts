import {IMessage, Payload} from './message-types';
import {Awaitable, Maybe, ReadonlyMany} from './utility-types';

/**
 * A handler that is aware of the initial agent state.
 *
 * @template State The aggregate state.
 */
export interface IStatefulHandler<State = unknown> {

  /**
   * Creates the initial state of the aggregate.
   */
  createInitialState(): State;
}

/**
 * A callback of the handler object that is invoked by a stateful agent to hydrate the state.
 */
export type EventCallback<Event extends IMessage, State> = (payload: Payload<Event>, state: State) => Awaitable<void>;

export type CommandCallback<Command extends IMessage, EventOrAlert extends IMessage, State = void> = (payload: Payload<Command>, state: Readonly<State>) => Awaitable<ReadonlyMany<EventOrAlert>>;

export type AdoptedEventCallback<Event extends IMessage, Command extends IMessage, State = void> = (payload: Payload<Event>, state: Readonly<State>) => Awaitable<Maybe<ReadonlyMany<Command>>>;
