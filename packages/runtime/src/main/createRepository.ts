// import {IAggregateSnapshot, IEventStore, IMessageDispatcher, IRepository} from './es-types';
//
// export function createRepository(eventStore: IEventStore, eventProducer: IMessageDispatcher): IRepository {
//   return {
//
//     exists(aggregate, id) {
//       return eventStore.exists(aggregate.name, id);
//     },
//
//     async load(aggregate, handler, id) {
//       const snapshot = await eventStore.loadSnapshot(aggregate.name, id);
//
//       const state = snapshot?.state as ReturnType<typeof handler.createInitialState> || handler.createInitialState();
//
//       const aggregateState: IAggregateSnapshot<typeof state> = {
//         id,
//         version: snapshot?.version || 0n,
//         state,
//       };
//
//       for await (const event of eventStore.loadEvents(aggregate.name, id, snapshot?.version)) {
//         aggregate.applyEvent(handler, event, state);
//         aggregateState.version = event.version;
//       }
//
//       return aggregateState;
//     },
//
//     async save(aggregate, aggregateState, events) {
//       await eventStore.saveEvents(aggregate.name, aggregateState, events);
//       await eventProducer.dispatch(events);
//     },
//   };
// }
