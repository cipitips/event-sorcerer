import {createInMemoryEventStore, IAggregateSnapshot, IEventStore, OptimisticLockError} from '../main';
import {Arrays} from '@smikhalevski/stdlib';
import {mockEvent} from './mock-utils';

describe('createInMemoryEventStore', () => {

  let eventStore: IEventStore;

  beforeEach(() => {
    eventStore = createInMemoryEventStore();
  });

  test('returns no events for absent aggregate', async () => {
    await expect(Arrays.fromIter(eventStore.loadEvents('Foo', 'abc'))).resolves.toEqual([]);
  });

  test('loads previously saved events', async () => {
    await eventStore.saveEvents('Foo', {id: 'abc', version: BigInt(1), state: {}}, [mockEvent({version: BigInt(2)})]);
    await eventStore.saveEvents('Foo', {id: 'abc', version: BigInt(2), state: {}}, [mockEvent({version: BigInt(3)})]);

    await expect(Arrays.fromIter(eventStore.loadEvents('Foo', 'abc'))).resolves.toEqual([
      mockEvent({version: BigInt(2)}),
      mockEvent({version: BigInt(3)}),
    ]);
  });

  test('loads previously saved events after particular version', async () => {
    await eventStore.saveEvents('Foo', {id: 'abc', version: BigInt(1), state: {}}, [mockEvent({version: BigInt(2)})]);
    await eventStore.saveEvents('Foo', {id: 'abc', version: BigInt(2), state: {}}, [mockEvent({version: BigInt(3)})]);

    await expect(Arrays.fromIter(eventStore.loadEvents('Foo', 'abc', BigInt(2)))).resolves.toEqual([
      mockEvent({version: BigInt(3)}),
    ]);
  });

  test('throws on optimistic lock violation', async () => {
    await eventStore.saveEvents('Foo', {id: 'abc', version: BigInt(1), state: {}}, [mockEvent({version: BigInt(2)})]);

    await expect(() => eventStore.saveEvents('Foo', {id: 'abc', version: BigInt(1), state: {}}, [mockEvent()])).rejects.toThrow(new OptimisticLockError());
  });

  test('aggregates with different names are stored separately', async () => {
    await eventStore.saveEvents('Foo', {id: 'abc', version: BigInt(1), state: {}}, [mockEvent({id: 'event1', version: BigInt(2)})]);
    await eventStore.saveEvents('Bar', {id: 'abc', version: BigInt(1), state: {}}, [mockEvent({id: 'event2', version: BigInt(2)})]);

    await expect(Arrays.fromIter(eventStore.loadEvents('Foo', 'abc'))).resolves.toEqual([
      mockEvent({id: 'event1', version: BigInt(2)}),
    ]);
    await expect(Arrays.fromIter(eventStore.loadEvents('Bar', 'abc'))).resolves.toEqual([
      mockEvent({id: 'event2', version: BigInt(2)}),
    ]);
  });

  test('aggregates with different IDs are stored separately', async () => {
    await eventStore.saveEvents('Foo', {id: 'abc', version: BigInt(1), state: {}}, [mockEvent({id: 'event1', version: BigInt(2)})]);
    await eventStore.saveEvents('Foo', {id: 'xyz', version: BigInt(1), state: {}}, [mockEvent({id: 'event2', version: BigInt(2)})]);

    await expect(Arrays.fromIter(eventStore.loadEvents('Foo', 'abc'))).resolves.toEqual([
      mockEvent({id: 'event1', version: BigInt(2)}),
    ]);
    await expect(Arrays.fromIter(eventStore.loadEvents('Foo', 'xyz'))).resolves.toEqual([
      mockEvent({id: 'event2', version: BigInt(2)}),
    ]);
  });

  test('returns no snapshot for absent aggregate', async () => {
    await expect(eventStore.loadSnapshot('Foo', 'abc')).resolves.toBe(undefined);
  });

  test('loads previously saved snapshot', async () => {
    await eventStore.saveSnapshot('Foo', {id: 'abc', version: BigInt(1), state: {bar: 'qux'}});

    await expect(eventStore.loadSnapshot('Foo', 'abc')).resolves.toEqual(<IAggregateSnapshot>{id: 'abc', version: BigInt(1), state: {bar: 'qux'}});
  });

  test('deletes an existing snapshot with matching version', async () => {
    await eventStore.saveSnapshot('Foo', {id: 'abc', version: BigInt(1), state: {bar: 'qux'}});
    await eventStore.dropSnapshot('Foo', 'abc', BigInt(1));

    await expect(eventStore.loadSnapshot('Foo', 'abc')).resolves.toBe(undefined);
  });

  test('does not delete an existing snapshot with non-matching version', async () => {
    await eventStore.saveSnapshot('Foo', {id: 'abc', version: BigInt(1), state: {bar: 'qux'}});
    await eventStore.dropSnapshot('Foo', 'abc', BigInt(2));

    await expect(eventStore.loadSnapshot('Foo', 'abc')).resolves.toEqual(<IAggregateSnapshot>{id: 'abc', version: BigInt(1), state: {bar: 'qux'}});
  });

});
