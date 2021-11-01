import {Uuid} from './utility-types';

/**
 * A message passed between agents.
 */
export interface IMessage {
  type: string;
  payload: unknown;
}

export type Payload<Message extends IMessage> = Readonly<Message['payload']>;

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
 * The factory that produces messages with given type.
 */
export type MessageFactory<Message extends IMessage> = (payload: Payload<Message>) => Message;
