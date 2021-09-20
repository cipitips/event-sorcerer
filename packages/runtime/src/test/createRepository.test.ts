import {
  createInMemoryEventStore,
  createInMemoryMessageDispatcher,
  createRepository,
  ISentAggregateMessage,
  ISentAggregateEvent,
  IAggregate,
  IAggregateHandler,
} from '../main';
import {toIter} from '../../../lib/src/main/lang/collections/Arrays';
import {mockEvent} from './mock-utils';

describe('createRepository', () => {

  test('saves events to the event store and publishes to them to the message bus', async () => {
    const aggregate: IAggregate<any> = {
      name: 'Foo',
      handleCommand(handler, command, state) {
        return [];
      },
      applyEvent(handler, event, state) {
      },
      isSupportedCommand(command): command is ISentAggregateMessage {
        return true;
      },
    };

    const eventStore = createInMemoryEventStore();
    const messageBus = createInMemoryMessageDispatcher(jest.fn());

    eventStore.saveEvents = jest.fn();
    messageBus.dispatch = jest.fn();

    const repo = createRepository(eventStore, messageBus);

    const event1 = mockEvent({version: BigInt(2)});
    const event2 = mockEvent({version: BigInt(3)});

    const aggregateState1 = {id: 'abc', version: BigInt(1), state: {bar: '123'}};
    const aggregateState2 = {id: 'abc', version: BigInt(2), state: {bar: '456'}};

    await repo.save(aggregate, aggregateState1, [event1]);

    expect(eventStore.saveEvents).toHaveBeenCalledTimes(1);
    expect(eventStore.saveEvents).toHaveBeenNthCalledWith(1, 'Foo', aggregateState1, [event1]);

    expect(messageBus.dispatch).toHaveBeenCalledTimes(1);
    expect(messageBus.dispatch).toHaveBeenNthCalledWith(1, [event1]);

    await repo.save(aggregate, aggregateState2, [event2]);

    expect(eventStore.saveEvents).toHaveBeenCalledTimes(2);
    expect(eventStore.saveEvents).toHaveBeenNthCalledWith(2, 'Foo', aggregateState2, [event2]);

    expect(messageBus.dispatch).toHaveBeenCalledTimes(2);
    expect(messageBus.dispatch).toHaveBeenNthCalledWith(2, [event2]);
  });

  test('loads aggregate and creates initial state', async () => {
    const aggregate: IAggregate<any> = {
      name: 'Foo',
      handleCommand: jest.fn(),
      applyEvent: jest.fn(),
      isSupportedCommand(command): command is ISentAggregateMessage {
        return true;
      },
    };

    const state = {foo: 'bar'};

    const handler: IAggregateHandler = {
      createInitialState: jest.fn(() => state),
    };

    const event1 = mockEvent({version: BigInt(2)});
    const event2 = mockEvent({version: BigInt(3)});

    const eventStore = createInMemoryEventStore();
    const messageBus = createInMemoryMessageDispatcher(jest.fn());

    eventStore.loadSnapshot = jest.fn(() => Promise.resolve(undefined));
    eventStore.loadEvents = jest.fn(() => toIter([event1, event2]));

    const repo = createRepository(eventStore, messageBus);

    await repo.load(aggregate, handler, 'abc');

    expect(eventStore.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(eventStore.loadSnapshot).toHaveBeenNthCalledWith(1, 'Foo', 'abc');

    expect(handler.createInitialState).toHaveBeenCalledTimes(1);
    expect(handler.createInitialState).toHaveBeenNthCalledWith(1);

    expect(eventStore.loadEvents).toHaveBeenCalledTimes(1);
    expect(eventStore.loadEvents).toHaveBeenNthCalledWith(1, 'Foo', 'abc', undefined);

    expect(aggregate.applyEvent).toHaveBeenCalledTimes(2);
    expect(aggregate.applyEvent).toHaveBeenNthCalledWith(1, handler, event1, state);
    expect(aggregate.applyEvent).toHaveBeenNthCalledWith(2, handler, event2, state);
  });

  test('loads aggregate from the snapshot', async () => {
    const aggregate: IAggregate<any> = {
      name: 'Foo',
      handleCommand: jest.fn(),
      applyEvent: jest.fn(),
      isSupportedCommand(command): command is ISentAggregateMessage {
        return true;
      },
    };

    const handler: IAggregateHandler = {
      createInitialState: jest.fn(),
    };

    const event1 = mockEvent({version: BigInt(2)});
    const event2 = mockEvent({version: BigInt(3)});

    const eventStore = createInMemoryEventStore();
    const messageBus = createInMemoryMessageDispatcher(jest.fn());

    const state = {foo: 'bar'};
    const aggregateState = {id: 'abc', version: BigInt(1), state};

    eventStore.loadSnapshot = jest.fn(() => Promise.resolve(aggregateState));
    eventStore.loadEvents = jest.fn(() => toIter([event1, event2]));

    const repo = createRepository(eventStore, messageBus);

    await repo.load(aggregate, handler, 'abc');

    expect(eventStore.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(eventStore.loadSnapshot).toHaveBeenNthCalledWith(1, 'Foo', 'abc');

    expect(handler.createInitialState).not.toHaveBeenCalled();

    expect(eventStore.loadEvents).toHaveBeenCalledTimes(1);
    expect(eventStore.loadEvents).toHaveBeenNthCalledWith(1, 'Foo', 'abc', BigInt(1));

    expect(aggregate.applyEvent).toHaveBeenCalledTimes(2);
    expect(aggregate.applyEvent).toHaveBeenNthCalledWith(1, handler, event1, state);
    expect(aggregate.applyEvent).toHaveBeenNthCalledWith(2, handler, event2, state);
  });
});
