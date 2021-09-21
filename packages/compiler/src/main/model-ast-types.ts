import {IJtd, ITsJtdMetadata} from '@jtdc/types';
import {HandlerType, IHandlerModel} from './model-types';

export interface IHandlerNode {
  handlerModel: IHandlerModel;
  handlerType: HandlerType;
  name: string;
  definitions?: Record<string, IJtd<ITsJtdMetadata>>;
  state?: IJtd<ITsJtdMetadata>;
  commands: Map<string, IMessageNode>;
  events: Map<string, IMessageNode>;
  alerts: Map<string, IMessageNode>;
  adoptedEvents: Set<IMessageRefNode>;
  adoptedCommands: Set<IMessageRefNode>;
}

export enum MessageType {
  COMMAND = 'command',
  EVENT = 'event',
  ALERT = 'alert',
}

export interface IMessageNode {
  messageType: MessageType;
  handler: IHandlerNode;
  type: string;
  payload: IJtd<ITsJtdMetadata>;
  description?: string;
  aggregateBy: Array<string>;
}

export interface IMessageRefNode {
  message: IMessageNode;
  aggregateBy: Array<string>;
}
