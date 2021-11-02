import {v4 as uuid4, v5 as uuid5} from 'uuid';
import {IVersionedMessage, IIdentifiableMessage, IMessage} from './message-types';
import {Uuid} from './utility-types';

/**
 * Creates a new command that originates from the message from an external system. For example, from the web client
 * request.
 *
 * @param command The command received from an external system.
 * @param requestId The optional request ID used as a command correlation ID.
 * @returns The command message.
 */
export function originateCommand(command: IMessage, requestId: Uuid = uuid4()): IIdentifiableMessage {
  return {
    type: command.type,
    id: requestId,
    payload: command.payload,
    timestamp: Date.now(),
    causationId: null,
    correlationId: requestId,
  };
}

/**
 * Creates a new command that was caused by an event.
 *
 * @param event An event that caused the command.
 * @param command The message with the command type and payload.
 * @param index The index of the command. This is required to distinguish multiple commands derived from a single event.
 * @returns The command message.
 */
export function deriveCommand(event: IIdentifiableMessage, command: IMessage, index: number): IIdentifiableMessage {
  return {
    id: uuid5(index.toString(), event.id),
    type: command.type,
    payload: command.payload,
    timestamp: Date.now(),
    causationId: event.id,
    correlationId: event.correlationId,
  };
}

/**
 * Creates a new event that was caused by a command.
 *
 * @param command A command that caused the event.
 * @param event The message with the event type and payload.
 * @param index The index of the event. This is required to distinguish multiple events derived from a single command.
 * @returns The event message.
 */
export function deriveEvent(command: IIdentifiableMessage, event: IMessage, index: number): IIdentifiableMessage {
  return {
    id: uuid5(index.toString(), command.id),
    type: event.type,
    payload: event.payload,
    timestamp: Date.now(),
    causationId: command.causationId,
    correlationId: command.correlationId,
  };
}

/**
 * Creates a new versioned event that was caused by a command.
 *
 * @param command A command that caused the event.
 * @param event The message with the event type and payload.
 * @param baseVersion The version of the aggregate that was used to validate the command.
 * @param index The index of the event. This is required to distinguish multiple events derived from a single command.
 * @returns The versioned event message.
 */
export function deriveAggregateEvent(command: IIdentifiableMessage, event: IMessage, baseVersion: bigint, index: number): IVersionedMessage {
  return {
    ...deriveEvent(command, event, index),
    version: baseVersion + BigInt(index),
  };
}
