import {IJtd} from '@jtdc/types';

/**
 * A model of an agent that processes messages.
 */
export interface IAgentModel {

  /**
   * The system-wide unique name of an agent that can be used by persistence or service discovery.
   */
  name: string;
  commands?: Array<IMessageModel>;
  events?: Array<IMessageModel>;
  alerts?: Array<IMessageModel>;
  adoptedCommands?: Array<IMessageRefModel>;
  adoptedEvents?: Array<IMessageRefModel>;
  adoptedAlerts?: Array<IMessageRefModel>;
}

/**
 * A model of a message passed between agents.
 */
export interface IMessageModel {

  /**
   * The message type name. Must be unique in scope of the handler.
   */
  type: string;

  /**
   * The JDT of message data payload.
   */
  payload: IJtd<unknown>;

  /**
   * The message description.
   */
  description?: string;
}

/**
 * A model of a reference to a message declared by an agent.
 */
export interface IMessageRefModel {

  /**
   * The {@link IAgentModel.name} of the handler that contains the referenced message model.
   */
  from: string;

  /**
   * The type of the referenced message.
   */
  type: string;
}
