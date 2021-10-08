import {IJtd} from '@jtdc/types';
import {AgentType} from '@event-sorcerer/runtime';

/**
 * A model of an agent that processes messages.
 */
export interface IAgentModel {

  /**
   * The type dictates kinds of messages that agent can receive and dispatch.
   */
  type: AgentType;

  /**
   * The system-wide unique name of an agent that can be used by persistence or service discovery.
   */
  name: string;
  state?: IJtd<unknown>;
  commands?: Array<IMessageModel>;
  events?: Array<IMessageModel>;
  alerts?: Array<IMessageModel>;
  adoptedEvents?: Array<IMessageRefModel>;
  adoptedCommands?: Array<IMessageRefModel>;
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

  /**
   * The JSON pointer to the property of the {@link payload} that should be used as an aggregate ID. Required for
   * aggregate events and process manager events and commands.
   */
  aggregateBy?: string;
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

  /**
   * The JSON pointer to the property of the {@link IMessageModel.payload} of referenced message that should be used as
   * an aggregate ID. Required for events adopted by process manager.
   */
  aggregateBy?: string;
}
