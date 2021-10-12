import {IMessage, MessageFactory} from './message-types';

export function createMessageFactory<Message extends IMessage>(type: Message['type']): MessageFactory<Message> {
  return (payload) => {
    return {type, payload} as Message;
  };
}
