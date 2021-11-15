import {Uuid} from './utility-types';

/**
 * A message passed between agents.
 */
export interface IMessage {

  /**
   * The type of the message is the system-wide unique string.
   */
  type: string;

  /**
   * The message payload.
   */
  payload: unknown;
}

/**
 * A message that has an ID.
 *
 * This message can be dispatched via messaging system.
 */
export interface IIdentifiableMessage extends IMessage {

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
 * A message with an ID and a version (for optimistic concurrency).
 */
export interface IVersionedMessage extends IIdentifiableMessage {

  /**
   * The monotonically ascending index of the message in scope of an event stream.
   */
  version: bigint;
}
