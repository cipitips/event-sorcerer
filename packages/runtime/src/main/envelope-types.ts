import {IMessage} from './message-types';
import {IAgent} from './agent-types';

export const enum MessageKind {
  COMMAND = 'command',
  EVENT = 'event',
  ALERT = 'alert',
}

/**
 * Envelope holds the metadata required to dispatch a message.
 */
export interface IEnvelope<Message extends IMessage> {

  /**
   * The agent that declared a message.
   */
  agent: IAgent;

  /**
   * The kind of a message.
   */
  messageKind: MessageKind;

  /**
   * The message that must be sent.
   */
  message: Message;
}
