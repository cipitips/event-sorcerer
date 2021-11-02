import {IMessage} from './message-types';

export function createMessageFactory<Message extends IMessage>(type: Message['type']): (payload: Message['payload']) => Message {
  return (payload) => {
    return {type, payload} as Message;
  };
}
