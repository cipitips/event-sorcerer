import {
  createEventSourcingRouter,
  createInMemoryEventStore,
  createInMemoryMessageDispatcher,
  createRepository,
  ISentAggregateMessage,
  ISentAggregateEvent,
  IAggregate,
  IAggregateHandler,
  ICommand,
  IMessage,
  IEventListener,
} from '../main';
import {mockCommand, mockEvent} from './mock-utils';

Date.now = () => 0;

describe('createEventSourcingContainer', () => {

  test('sends command to an aggregate', async () => {

    const eventConsumer = jest.fn();
    const commandConsumer = jest.fn();

    const eventStore = createInMemoryEventStore();
    const eventBus = createInMemoryMessageDispatcher<ISentAggregateEvent>(eventConsumer);
    const commandBus = createInMemoryMessageDispatcher<ISentAggregateMessage>(commandConsumer);

    const repo = createRepository(eventStore, eventBus);
    repo.save = jest.fn();

    const container = createEventSourcingRouter(repo, commandBus);

    const aggregate: IAggregate = {
      name: 'Foo',
      handleCommand: jest.fn(() => <ReadonlyArray<IMessage>>[
        {type: 'event1Type', payload: {foo: 777}},
      ]),
      applyEvent: jest.fn(),
      isSupportedCommand(command: ISentAggregateMessage): command is ISentAggregateMessage {
        return true;
      },
    };
    const handler: IAggregateHandler = {
      createInitialState() {
        return {bar: 'baz'};
      },
    };

    container.registerAggregate(aggregate, handler);

    const command = mockCommand({
      aggregateId: 'www',
      id: '8091dce3-881c-44eb-bcfc-21544b61f3cc',
      causationId: 'bar',
      correlationId: 'foo',
    });

    await container.handleCommand(command);

    expect(aggregate.handleCommand).toHaveBeenCalledTimes(1);
    expect(aggregate.handleCommand).toHaveBeenNthCalledWith(1, handler, command, {bar: 'baz'});

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenNthCalledWith(1,
        aggregate,
        {id: 'www', version: BigInt(0), state: {bar: 'baz'}},
        [
          mockEvent({
            id: 'a91f02da-d5ba-53aa-b9b3-a44a146ee002',
            type: 'event1Type',
            causationId: 'bar',
            correlationId: 'foo',
            version: BigInt(1),
            aggregateId: 'www',
            payload: {foo: 777},
          }),
        ],
    );
  });

  test('sends event to a process manager', async () => {

    const eventConsumer = jest.fn();
    const commandConsumer = jest.fn();

    const eventStore = createInMemoryEventStore();
    const eventBus = createInMemoryMessageDispatcher<ISentAggregateEvent>(eventConsumer);
    const commandBus = createInMemoryMessageDispatcher<ISentAggregateMessage>(commandConsumer);
    commandBus.dispatch = jest.fn();

    const repo = createRepository(eventStore, eventBus);
    repo.save = jest.fn();

    const container = createEventSourcingRouter(repo, commandBus);

    const processManager: IEventListener = {
      name: 'Foo',
      handleAdoptedEvent: jest.fn(() => <ReadonlyArray<ICommand>>[
        {
          type: 'command1Type',
          aggregateId: 'www',
          payload: {rrr: 777},
        },
      ]),
      isAdoptedEvent(event: ISentAggregateEvent): event is ISentAggregateEvent {
        return true;
      },
    };
    const handler = {
      qqq: 'eee',
    };

    container.registerEventListener(processManager, handler);

    const event = mockEvent({
      aggregateId: 'www',
      id: '8091dce3-881c-44eb-bcfc-21544b61f3cc',
      causationId: 'bar',
      correlationId: 'foo',
    });

    await container.handleEvent(event);

    expect(processManager.handleAdoptedEvent).toHaveBeenCalledTimes(1);
    expect(processManager.handleAdoptedEvent).toHaveBeenNthCalledWith(1, handler, event);

    expect(commandBus.dispatch).toHaveBeenCalledTimes(1);
    expect(commandBus.dispatch).toHaveBeenNthCalledWith(1, [
      mockCommand({
        id: 'a91f02da-d5ba-53aa-b9b3-a44a146ee002',
        type: 'command1Type',
        causationId: 'bar',
        correlationId: 'foo',
        aggregateId: 'www',
        payload: {rrr: 777},
      }),
    ]);

  });
});
