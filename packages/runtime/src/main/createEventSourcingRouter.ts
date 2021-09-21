import {
  IAggregate,
  IAggregateHandler,
  IDispatchedMessage,
  IEventListener,
  IMessage,
  IMessageDispatcher,
  IProcessManager,
  IRepository,
  OptimisticLockError,
} from './es-types';
import {deriveCommand, deriveVersionedEvent} from './es-utils';
import {Arrays} from '@smikhalevski/stdlib';

export interface IEventSourcingRouter {

  registerAggregate<A extends IAggregate<unknown, Handler>, Handler extends IAggregateHandler>(aggregate: A, handler: Handler): void;

  registerProcessManager<P extends IProcessManager<unknown, Handler>, Handler extends IAggregateHandler>(aggregate: P, handler: Handler): void;

  registerEventListener<P extends IEventListener<Handler>, Handler>(processManager: P, handler: Handler): void;

  handleEvent(message: IDispatchedMessage): Promise<void>;

  handleCommand(message: IDispatchedMessage): Promise<void>;
}

export function createEventSourcingRouter(repository: IRepository, commandDispatcher: IMessageDispatcher): IEventSourcingRouter {

  const aggregateMap = new Map<IAggregate, IAggregateHandler>();
  const processManagerMap = new Map<IProcessManager, IAggregateHandler>();
  const eventListenerMap = new Map<IEventListener, unknown>();

  return {

    async handleCommand(command) {
      let aggregate: IAggregate | undefined;
      let handler: IAggregateHandler | undefined;

      for (const entry of aggregateMap) {
        if (entry[0].isSupportedCommand(command)) {
          [aggregate, handler] = entry;
          break;
        }
      }
      if (aggregate == null) {
        for (const entry of processManagerMap) {
          if (entry[0].isSupportedCommand(command)) {
            [aggregate, handler] = entry;
            break;
          }
        }
      }

      if (aggregate == null || handler == null) {
        throw new UnhandledCommandError();
      }

      for (let i = 0; true; i++) {
        const snapshot = await repository.load(aggregate, handler, aggregate.getAggregateId(command));
        const events = aggregate.handleCommand(handler, command, snapshot.state);

        if (events == null || Array.isArray(events) && events.length === 0) {
          return;
        }

        const nextEvents = Arrays.fromMany(events).map((event, index) => deriveVersionedEvent(command, event, snapshot.version, index));

        try {
          await repository.save(aggregate, snapshot, nextEvents);
          return;
        } catch (error) {
          if (error instanceof OptimisticLockError && i < 5) {
            continue;
          }
          throw error;
        }
      }
    },

    async handleEvent(event) {
      const allCommands: Array<Readonly<IMessage>> = [];

      for (const [processManager, handler] of eventListenerMap) {
        if (processManager.isAdoptedEvent(event)) {
          const commands = await processManager.handleAdoptedEvent(handler, event);
          if (commands) {
            allCommands.push(...Arrays.fromMany(commands));
          }
        }
      }
      for (const [aggregate, handler] of processManagerMap) {
        if (aggregate.isAdoptedEvent(event)) {
          const aggregateState = await repository.load(aggregate, handler, aggregate.getAggregateId(event));
          const commands = await aggregate.handleAdoptedEvent(handler, event, aggregateState);
          if (commands) {
            allCommands.push(...Arrays.fromMany(commands));
          }
        }
      }
      if (allCommands.length === 0) {
        return;
      }
      const nextCommands = allCommands.map((command, index) => deriveCommand(event, command, index));

      await commandDispatcher.dispatch(nextCommands);
    },

    registerAggregate(aggregate, handler) {
      aggregateMap.set(aggregate, handler);
    },

    registerProcessManager(processManagerAggregate, handler) {
      processManagerMap.set(processManagerAggregate, handler);
    },

    registerEventListener(processManager, handler) {
      eventListenerMap.set(processManager, handler);
    },
  };
}

export class UnhandledCommandError extends Error {
}
