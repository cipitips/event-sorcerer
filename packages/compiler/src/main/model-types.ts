import {IJtd, ITsJtdMetadata} from '@jtdc/types';

export enum HandlerType {
  AGGREGATE = 'aggregate',
  PROCESS_MANAGER = 'processManager',
  EVENT_LISTENER = 'eventListener',
  SERVICE = 'service',
}

export interface IHandlerModel {
  handlerType: HandlerType;
  name: string;
  definitions?: Record<string, IJtd<ITsJtdMetadata>>;
  commands?: Array<IMessageModel>;
  events?: Array<IMessageModel>;
  alerts?: Array<IMessageModel>;
  adoptedEvents?: Array<IMessageRef>;
  adoptedCommands?: Array<IMessageRef>;
}

export interface IMessageModel {
  type: string;
  payload: IJtd<ITsJtdMetadata>;
  description?: string;
  aggregateBy?: string;
}

export interface IMessageRef {
  from: string;
  type: string;
  aggregateBy?: string;
}
