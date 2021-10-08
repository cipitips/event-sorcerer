// import {IDispatchedMessage, IMessageDispatcher} from './es-types';
// import {Arrays} from '@smikhalevski/stdlib';
//
// export function createInMemoryMessageDispatcher(consumer: (message: IDispatchedMessage) => Promise<void>): IMessageDispatcher {
//   let promise = Promise.resolve();
//   return {
//
//     dispatch(messages) {
//       for (const message of Arrays.fromMany(messages)) {
//         promise = promise.then(() => consumer(message));
//       }
//       return Promise.resolve();
//     },
//   };
// }
