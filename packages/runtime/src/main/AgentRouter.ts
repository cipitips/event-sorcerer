import {Agent, AgentType} from './agent-types';
import {IIdentifiableMessage, IMessage} from './message-types';
import {IRepository} from './store-types';
import {deriveCommand, deriveEvent, deriveAggregateEvent} from './message-utils';
import {Arrays} from '@smikhalevski/stdlib';
import {IStatefulHandler} from './handler-types';
import {ReadonlyMany} from './utility-types';

/**
 * Routes a message to an agent that can handle it.
 */
export class AgentRouter {

  protected agentHandlers = new Map<Agent, any>();
  protected repository;

  constructor(repository: IRepository) {
    this.repository = repository;
  }

  public registerAgentHandler(agent: Agent, handler: unknown): void {
    this.agentHandlers.set(agent, handler);
  }

  /**
   * Routes an event to agents that support it and dispatches the returned commands.
   */
  public async handleEvent(event: IIdentifiableMessage): Promise<void> {
    const commands: Array<IMessage> = [];

    for (const [agent, handler] of this.agentHandlers) {
      let agentCommands;

      if (agent.type === AgentType.EVENT_LISTENER && agent.isAdoptedEvent(event)) {
        agentCommands = await agent.handleAdoptedEvent(handler, event);
      }

      if (agent.type === AgentType.PROCESS_MANAGER && agent.isAdoptedEvent(event)) {
        const snapshot = await this.repository.load(agent, handler, agent.getAggregateId(event));
        agentCommands = await agent.handleAdoptedEvent(handler, event, snapshot.state);
      }

      if (agentCommands) {
        commands.push(...Arrays.fromMany(agentCommands));
      }
    }

    commands.map((command, index) => deriveCommand(event, command, index));
  }

  public async handleCommand(command: IIdentifiableMessage): Promise<void> {

    let events: readonly IMessage[] | undefined;

    for (const [agent, handler] of this.agentHandlers) {

      const agentType = agent.type;

      if (agentType === AgentType.SERVICE && agent.isSupportedCommand(command)) {
        events = Arrays.fromMany(await agent.handleCommand(handler, command)).map((event, index) => deriveEvent(command, event, index));
        break;
      }

      if ((agentType === AgentType.PROCESS_MANAGER || agentType === AgentType.AGGREGATE) && agent.isSupportedCommand(command)) {
        const snapshot = await this.repository.load(agent, handler, agent.getAggregateId(command));
        events = Arrays.fromMany(await agent.handleCommand(handler, command, snapshot.state)).map((event, index) => deriveAggregateEvent(command, event, snapshot.version, index));
        break;
      }
    }

    if (events?.length) {
      // dispatch
    }
  }

}
