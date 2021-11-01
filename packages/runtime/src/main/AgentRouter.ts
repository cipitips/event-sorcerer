import {Agent, AgentType} from './agent-types';
import {IDispatchedMessage, IMessage} from './message-types';
import {IRepository} from './store-types';
import {deriveCommand, deriveVersionedEvent} from './message-utils';
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
  public async handleEvent(event: IDispatchedMessage): Promise<void> {
    const commands: Array<IMessage> = [];

    for (const [agent, handler] of this.agentHandlers) {
      let agentCommands;

      if (agent.type === AgentType.EVENT_LISTENER && agent.isAdoptedEvent(event)) {
        agentCommands = await agent.handleAdoptedEvent(handler, event);
      }

      if (agent.type === AgentType.PROCESS_MANAGER && agent.isAdoptedEvent(event)) {
        const snapshot = await this.repository.load(agent, handler as IStatefulHandler, agent.getAggregateId(event));
        agentCommands = await agent.handleAdoptedEvent(handler as IStatefulHandler, event, snapshot.state);
      }

      if (agentCommands) {
        commands.push(...Arrays.fromMany(agentCommands));
      }
    }

    commands.map((command, index) => deriveCommand(event, command, index));
  }

  public async handleCommand(command: IDispatchedMessage): Promise<void> {

    let events: readonly IMessage[];

    for (const [agent, handler] of this.agentHandlers) {

      const agentType = agent.type;

      if (agentType === AgentType.SERVICE && agent.isSupportedCommand(command)) {
        events = Arrays.fromMany(await agent.handleCommand(handler, command)).map((event));
        break;
      }

      if ((agentType === AgentType.PROCESS_MANAGER || agentType === AgentType.AGGREGATE) && agent.isSupportedCommand(command)) {
        const snapshot = await this.repository.load(agent, handler, agent.getAggregateId(command));
        events = await agent.handleCommand(handler, command, snapshot.state);
        break;
      }
    }

    if (!events) {
      return;
    }

    Arrays.fromMany(events).map((event, index) => deriveVersionedEvent(command, event, snapshot.version, index));

  }

}
