import {IIdentifiableMessage, IMessage} from './message-types';
import {IRepository} from './store-types';
import {deriveCommand, deriveEvent, deriveVersionedEvent} from './message-utils';
import {Arrays} from '@smikhalevski/stdlib';
import {IAgent} from './agent-types';
import {IEnvelope} from './envelope-types';

/**
 * Routes a message to an agent that can handle it.
 */
export class AgentRouter {

  protected agentHandlers = new Map<IAgent, any>();
  protected repository;
  protected dispatcher;

  constructor(repository: IRepository, dispatcher: (envelope: Array<IEnvelope<IMessage>>) => void) {
    this.repository = repository;
    this.dispatcher = dispatcher;
  }

  public registerAgentHandler(agent: IAgent, handler: unknown): void {
    this.agentHandlers.set(agent, handler);
  }

  /**
   * Routes an event to agents that support it and dispatches the returned commands.
   */
  public async handleEvent(event: IIdentifiableMessage): Promise<void> {
    const commands: Array<IMessage> = [];

    for (const [agent, handler] of this.agentHandlers) {
      if (!agent.adoptedEventMap?.has(event.type)) {
        continue;
      }
      const snapshot = agent.getAggregateId ? await this.repository.load(agent, handler, agent.getAggregateId(event)) : undefined;

      const c = await agent.handleAdoptedEvent?.(handler, event, snapshot?.state);
      if (c) {
        commands.push(...Arrays.fromMany(c));
      }
    }

    commands.map((command, index) => deriveCommand(event, command, index));
  }

  public async handleCommand(command: IIdentifiableMessage): Promise<void> {

    let events: readonly IMessage[] | undefined;

    for (const [agent, handler] of this.agentHandlers) {
      if (!agent.commandTypes?.has(command.type)) {
        continue;
      }
      const snapshot = agent.getAggregateId ? await this.repository.load(agent, handler, agent.getAggregateId(command)) : undefined;

      const e = await agent.handleCommand?.(handler, command, snapshot?.state);
      if (e) {
        events = agent.getAggregateId ? Arrays.fromMany(e).map((event, index) => deriveVersionedEvent(command, event, snapshot?.version || 0n, index)) : Arrays.fromMany(e).map((event, index) => deriveEvent(command, event, index));
      }
    }

    if (events?.length) {
      // dispatch
    }
  }

}
