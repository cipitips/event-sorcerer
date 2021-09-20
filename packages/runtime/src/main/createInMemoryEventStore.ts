import {IAggregateSnapshot, IEventStore, IVersionedMessage, OptimisticLockError} from './es-types';
import {IDict} from '@smikhalevski/stdlib';

export function createInMemoryEventStore(): IEventStore {

  const eventDb: IDict<IDict<Array<IVersionedMessage>>> = {};

  const snapshotDb: IDict<IDict<IAggregateSnapshot>> = {};

  return {

    exists(name, id) {
      return Promise.resolve(eventDb[name]?.[id] != null || snapshotDb[name]?.[id] != null);
    },

    loadSnapshot(name, id) {
      return Promise.resolve(snapshotDb[name]?.[id]);
    },

    saveSnapshot(name, snapshot) {
      const table = snapshotDb[name] ||= {};

      if (table[snapshot.id] != null && table[snapshot.id].version > snapshot.version) {
        throw new OptimisticLockError();
      }

      table[snapshot.id] = snapshot;
      return Promise.resolve();
    },

    dropSnapshot(name, id, version) {
      const snapshot = snapshotDb[name]?.[id];

      if (snapshot?.version === version) {
        delete snapshotDb[name][id];
      }
      return Promise.resolve();
    },

    async* loadEvents(name, id, baseVersion = BigInt(0)) {
      const stream = eventDb[name]?.[id];
      if (stream) {
        for (const event of stream) {
          if (event.version > baseVersion) {
            yield event;
          }
        }
      }
    },

    saveEvents(name, snapshot, events) {
      const table = eventDb[name] ||= {};
      const stream = table[snapshot.id] ||= [];

      if (stream.length !== 0 && stream[stream.length - 1].version !== snapshot.version) {
        return Promise.reject(new OptimisticLockError());
      }

      stream.push(...events);
      return Promise.resolve();
    },
  };
}
