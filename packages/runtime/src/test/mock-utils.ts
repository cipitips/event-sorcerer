import {ISentAggregateMessage, ISentAggregateEvent} from '../main';

export function mockEvent(overrides?: Partial<ISentAggregateEvent>): ISentAggregateEvent {
  return {
    id: '',
    type: '',
    payload: {},
    timestamp: 0,
    aggregateId: '',
    version: BigInt(0),
    causationId: '',
    correlationId: '',
    ...overrides,
  };
}

export function mockCommand(overrides?: Partial<ISentAggregateMessage>): ISentAggregateMessage {
  return {
    id: '',
    type: '',
    payload: {},
    timestamp: 0,
    aggregateId: '',
    causationId: '',
    correlationId: '',
    ...overrides,
  };
}
