import {v4 as uuid4, v5 as uuid5} from 'uuid';
import {IDispatchedMessage, IMessage, IVersionedMessage, Uuid} from './es-types';

/**
 * Creates a new dispatched command that originates from the user request.
 */
export function originateCommand(command: IMessage, requestId: Uuid = uuid4()): IDispatchedMessage {
  return {
    type: command.type,
    id: requestId,
    payload: command.payload,
    timestamp: Date.now(),
    causationId: null,
    correlationId: requestId,
  };
}

export function deriveCommand(event: IDispatchedMessage, command: IMessage, index: number): IDispatchedMessage {
  return {
    id: uuid5(index.toString(), event.id),
    type: command.type,
    payload: command.payload,
    timestamp: Date.now(),
    causationId: event.id,
    correlationId: event.correlationId,
  };
}

export function deriveEvent(command: IDispatchedMessage, event: IMessage, index: number): IDispatchedMessage {
  return {
    id: uuid5(index.toString(), command.id),
    type: event.type,
    payload: event.payload,
    timestamp: Date.now(),
    causationId: command.causationId,
    correlationId: command.correlationId,
  };
}

export function deriveVersionedEvent(command: IDispatchedMessage, event: IMessage, baseVersion: bigint, index: number): IVersionedMessage {
  return {
    ...deriveEvent(command, event, index),
    version: baseVersion + BigInt(index),
  };
}
