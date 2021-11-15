import {MemoryEventStore} from '../main/MemoryEventStore';
import {ISnapshot, IVersionedMessage, OptimisticLockError} from '../main';

async function collect<T>(iterable: AsyncIterable<T>): Promise<Array<T>> {
  const arr: Array<T> = [];
  for await (const value of iterable) {
    arr.push(value);
  }
  return arr;
}

export function mockEvent(overrides?: Partial<IVersionedMessage>): IVersionedMessage {
  return {
    id: '',
    type: '',
    payload: {},
    timestamp: 0,
    version: 0n,
    causationId: '',
    correlationId: '',
    ...overrides,
  };
}

describe('MemoryEventStore', () => {

  let eventStore: MemoryEventStore;

  beforeEach(() => {
    eventStore = new MemoryEventStore();
  });

  test('returns no events for absent aggregate', async () => {
    await expect(collect(eventStore.loadEvents('abc', '123'))).resolves.toEqual([]);
  });

  test('loads previously saved events', async () => {
    await eventStore.saveEvents('abc', {id: '123', version: 1n, state: {}}, [mockEvent({version: 2n})]);
    await eventStore.saveEvents('abc', {id: '123', version: 2n, state: {}}, [mockEvent({version: 3n})]);

    await expect(collect(eventStore.loadEvents('abc', '123'))).resolves.toEqual([
      mockEvent({version: 2n}),
      mockEvent({version: 3n}),
    ]);
  });

  test('loads previously saved events after particular version', async () => {
    await eventStore.saveEvents('abc', {id: '123', version: 1n, state: {}}, [mockEvent({version: 2n})]);
    await eventStore.saveEvents('abc', {id: '123', version: 2n, state: {}}, [mockEvent({version: 3n})]);

    await expect(collect(eventStore.loadEvents('abc', '123', 2n))).resolves.toEqual([
      mockEvent({version: 3n}),
    ]);
  });

  test('throws on optimistic lock violation', async () => {
    await eventStore.saveEvents('abc', {id: '123', version: 1n, state: {}}, [mockEvent({version: 2n})]);

    await expect(() => eventStore.saveEvents('abc', {
      id: '123',
      version: 1n,
      state: {},
    }, [mockEvent()])).rejects.toThrow(new OptimisticLockError('abc'));
  });

  test('aggregates with different names are stored separately', async () => {
    await eventStore.saveEvents('abc', {id: '123', version: 1n, state: {}}, [mockEvent({id: 'event1', version: 2n})]);
    await eventStore.saveEvents('Bar', {id: '123', version: 1n, state: {}}, [mockEvent({id: 'event2', version: 2n})]);

    await expect(collect(eventStore.loadEvents('abc', '123'))).resolves.toEqual([
      mockEvent({id: 'event1', version: 2n}),
    ]);
    await expect(collect(eventStore.loadEvents('Bar', '123'))).resolves.toEqual([
      mockEvent({id: 'event2', version: 2n}),
    ]);
  });

  test('aggregates with different IDs are stored separately', async () => {
    await eventStore.saveEvents('abc', {id: '123', version: 1n, state: {}}, [mockEvent({id: 'event1', version: 2n})]);
    await eventStore.saveEvents('abc', {id: 'xyz', version: 1n, state: {}}, [mockEvent({id: 'event2', version: 2n})]);

    await expect(collect(eventStore.loadEvents('abc', '123'))).resolves.toEqual([
      mockEvent({id: 'event1', version: 2n}),
    ]);
    await expect(collect(eventStore.loadEvents('abc', 'xyz'))).resolves.toEqual([
      mockEvent({id: 'event2', version: 2n}),
    ]);
  });

  test('returns no snapshot for absent aggregate', async () => {
    await expect(eventStore.loadSnapshot('abc', '123')).resolves.toBe(undefined);
  });

  test('loads previously saved snapshot', async () => {
    await eventStore.saveSnapshot('abc', {id: '123', version: 1n, state: {bar: 'qux'}});

    const snapshot: ISnapshot = {id: '123', version: 1n, state: {bar: 'qux'}};

    await expect(eventStore.loadSnapshot('abc', '123')).resolves.toEqual(snapshot);
  });

  test('deletes an existing snapshot with matching version', async () => {
    await eventStore.saveSnapshot('abc', {id: '123', version: 1n, state: {bar: 'qux'}});
    await eventStore.dropSnapshot('abc', '123', 1n);

    await expect(eventStore.loadSnapshot('abc', '123')).resolves.toBe(undefined);
  });

  test('does not delete an existing snapshot with non-matching version', async () => {
    await eventStore.saveSnapshot('abc', {id: '123', version: 1n, state: {bar: 'qux'}});
    await eventStore.dropSnapshot('abc', '123', 2n);

    const snapshot: ISnapshot = {id: '123', version: 1n, state: {bar: 'qux'}};

    await expect(eventStore.loadSnapshot('abc', '123')).resolves.toEqual(snapshot);
  });

});
