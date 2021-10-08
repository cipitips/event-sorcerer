import {IAgentModel, IMessageModel, IMessageRefModel} from './model-types';
import {camelCase, constantCase, pascalCase} from 'change-case-all';
import {AgentType} from '@event-sorcerer/runtime';
import {compileDocComment, compilePropertyAccessor} from '@smikhalevski/codegen';
import {createMap, die} from './misc';
import {fromJsonPointer} from '@jtdc/jtd-dialect/lib/json-pointer';

export enum MessageKind {
  COMMANDS = 'commands',
  EVENTS = 'events',
  ALERTS = 'alerts',
}

export interface IAgentModelsCompilerOptions {

  renameAgentInterface?(agentModel: IAgentModel): string;

  renameAgentHandlerInterface?(agentModel: IAgentModel): string;

  renameAggregateStateInterface?(agentModel: IAgentModel): string;

  renameAgentSingletonConst?(agentModel: IAgentModel): string;

  renameMessageFactoryMethod?(messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind): string;

  renameMessageInterface?(messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind): string;

  rewriteMessageType?(messageModel: IMessageModel, agentModel: IAgentModel): string;

  renameMessageTypeEnum?(agentModel: IAgentModel, messageKind: MessageKind): string;

  renameMessageUnionType?(agentModel: IAgentModel, messageKind: MessageKind): string;

  renameAdoptedCommandUnionType?(agentModel: IAgentModel): string;

  renameAdoptedEventUnionType?(agentModel: IAgentModel): string;

  renameHandleCommand?(messageModel: IMessageModel, agentModel: IAgentModel): string;

  renameHandleEvent?(messageModel: IMessageModel, agentModel: IAgentModel): string;

  renameHandleAdoptedEvent?(messageModel: IMessageModel, agentModel: IAgentModel): string;
}

export function compileAgentModels(agentModels: Record<string, IAgentModel>, options?: IAgentModelsCompilerOptions): Record<string, string> {
  const resolvedOptions = {...agentModelsCompilerOptions, ...options};

  const sourceMap = createMap<string>();

  for (const [filePath, agentModel] of Object.entries(agentModels)) {
    sourceMap[filePath] = compileAgentModel(agentModels, agentModel, resolvedOptions);
  }
  return sourceMap;
}

function compileAgentModel(agentModels: Record<string, IAgentModel>, agentModel: IAgentModel, options: Required<IAgentModelsCompilerOptions>): string {

  const {
    renameAgentInterface,
    renameAgentHandlerInterface,
    renameAggregateStateInterface,
    renameAgentSingletonConst,
    renameMessageFactoryMethod,
    renameMessageInterface,
    rewriteMessageType,
    renameMessageTypeEnum,
    renameMessageUnionType,
    renameAdoptedCommandUnionType,
    renameAdoptedEventUnionType,
    renameHandleCommand,
    renameHandleEvent,
    renameHandleAdoptedEvent,
  } = options;

  let src = '';

  const stateful = agentModel.type === AgentType.AGGREGATE || agentModel.type === AgentType.PROCESS_MANAGER;

  const agentTypeName = renameAgentInterface(agentModel);
  const agentHandlerTypeName = renameAgentHandlerInterface(agentModel);
  const aggregateStateTypeName = renameAggregateStateInterface(agentModel);
  const agentSingletonConstName = renameAgentSingletonConst(agentModel);

  const commandTypeName = renameMessageUnionType(agentModel, MessageKind.COMMANDS);
  const eventTypeName = renameMessageUnionType(agentModel, MessageKind.EVENTS);
  const alertTypeName = renameMessageUnionType(agentModel, MessageKind.ALERTS);
  const adoptedCommandTypeName = renameAdoptedCommandUnionType(agentModel);
  const adoptedEventTypeName = renameAdoptedEventUnionType(agentModel);

  const compileMessageType = (messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind) =>
      renameMessageTypeEnum(agentModel, messageKind) + '.' + constantCase(messageModel.type);


  // Agent
  // ======================

  switch (agentModel.type) {

    case AgentType.AGGREGATE:
      src += `export interface ${agentTypeName} extends IAggregate<`
          + aggregateStateTypeName
          + ',' + agentHandlerTypeName
          + ',' + commandTypeName
          + ',' + eventTypeName
          + ',' + alertTypeName
          + '>{';
      break;

    case AgentType.PROCESS_MANAGER:
      src += `export interface ${agentTypeName} extends IProcessManager<`
          + aggregateStateTypeName
          + ',' + agentHandlerTypeName
          + ',' + commandTypeName
          + ',' + eventTypeName
          + ',' + alertTypeName
          + ',' + adoptedCommandTypeName
          + ',' + adoptedEventTypeName
          + '>{';
      break;

    case AgentType.EVENT_LISTENER:
      src += `export interface ${agentTypeName} extends IEventListener<`
          + agentHandlerTypeName
          + ',' + adoptedCommandTypeName
          + ',' + adoptedEventTypeName
          + '>{';
      break;

    case AgentType.SERVICE:
      src += `export interface ${agentTypeName} extends IService<`
          + agentHandlerTypeName
          + ',' + commandTypeName
          + ',' + eventTypeName
          + ',' + alertTypeName
          + '>{';
      break;
  }

  // Command factories
  if (agentModel.commands) {
    for (const messageModel of agentModel.commands) {
      const messageTypeName = renameMessageInterface(messageModel, agentModel, MessageKind.COMMANDS);

      src += compileDocComment(messageModel.description)
          + renameMessageFactoryMethod(messageModel, agentModel, MessageKind.COMMANDS)
          + `(payload:${messageTypeName}['payload']):${messageTypeName};`;
    }
  }

  // Event factories
  if (agentModel.events) {
    for (const messageModel of agentModel.events) {
      const messageTypeName = renameMessageInterface(messageModel, agentModel, MessageKind.EVENTS);

      src += compileDocComment(messageModel.description)
          + renameMessageFactoryMethod(messageModel, agentModel, MessageKind.EVENTS)
          + `(payload:${messageTypeName}['payload']):${messageTypeName};`;
    }
  }

  // Alert factories
  if (agentModel.alerts) {
    for (const messageModel of agentModel.alerts) {
      const messageTypeName = renameMessageInterface(messageModel, agentModel, MessageKind.ALERTS);

      src += compileDocComment(messageModel.description)
          + renameMessageFactoryMethod(messageModel, agentModel, MessageKind.ALERTS)
          + `(payload:${messageTypeName}['payload']):${messageTypeName};`;
    }
  }

  src += '}';


  // Agent handler
  // ======================

  src += 'export interface ' + agentHandlerTypeName;

  src += stateful ? ` extends IAggregateHandler<${aggregateStateTypeName}>{` : '{';

  // Handle adopted events
  if (agentModel.adoptedEvents) {
    for (const ref of agentModel.adoptedEvents) {
      const messageModel = getReferencedMessageModel(agentModels, ref, MessageKind.EVENTS);

      src += renameHandleAdoptedEvent(messageModel, agentModel)
          + `(payload:${renameMessageInterface(messageModel, agentModel, MessageKind.EVENTS)}['payload'])`
          + `:Awaitable<Maybe<ReadonlyMany<${adoptedCommandTypeName}>>>;`;
    }
  }

  // Handle commands
  if (agentModel.commands) {
    for (const messageModel of agentModel.commands) {
      src += renameHandleCommand(messageModel, agentModel)
          + '('
          + `payload:${renameMessageInterface(messageModel, agentModel, MessageKind.COMMANDS)}['payload']`
          + (stateful ? `,state:Readonly<${aggregateStateTypeName}>` : '')
          + ')'
          + `:Awaitable<ReadonlyMany<${eventTypeName}>>;`;
    }
  }

  // Handle events
  if (agentModel.events) {
    for (const messageModel of agentModel.events) {
      src += renameHandleCommand(messageModel, agentModel)
          + '('
          + `payload:${renameMessageInterface(messageModel, agentModel, MessageKind.EVENTS)}['payload']`
          + (stateful ? `,state:${aggregateStateTypeName}` : '')
          + ')'
          + `:void;`;
    }
  }

  src += '}';


  // Constants
  // ======================

  // Event types
  if (agentModel.events) {
    src += `const eventTypes=new Set(`
        + agentModel.events.map((messageModel) => compileMessageType(messageModel, agentModel, MessageKind.EVENTS)).join(',')
        + `)`;
  }

  // Command types
  if (agentModel.commands) {
    src += `const commandTypes=new Set(`
        + agentModel.commands.map((messageModel) => compileMessageType(messageModel, agentModel, MessageKind.EVENTS)).join(',')
        + `)`;
  }

  // Singleton

  src += `export const ${agentSingletonConstName}:${agentTypeName}={`
      + `name:${JSON.stringify(agentModel.name)},`;

  // Command factories
  if (agentModel.commands) {
    for (const messageModel of agentModel.commands) {
      src += renameMessageFactoryMethod(messageModel, agentModel, MessageKind.COMMANDS)
          + `(payload){return{type:${compileMessageType(messageModel, agentModel, MessageKind.COMMANDS)},payload};},`;
    }
  }

  // Event factories
  if (agentModel.events) {
    for (const messageModel of agentModel.events) {
      src += renameMessageFactoryMethod(messageModel, agentModel, MessageKind.EVENTS)
          + `(payload){return{type:${compileMessageType(messageModel, agentModel, MessageKind.EVENTS)},payload};},`;
    }
  }

  // Alert factories
  if (agentModel.alerts) {
    for (const messageModel of agentModel.alerts) {
      src += renameMessageFactoryMethod(messageModel, agentModel, MessageKind.ALERTS)
          + `(payload){return{type:${compileMessageType(messageModel, agentModel, MessageKind.ALERTS)},payload};},`;
    }
  }

  if (stateful) {

    // isSupportedEvent
    src += `isSupportedEvent(message):message is ${eventTypeName}{return eventTypes.has(message.type)},`;

    // getAggregateId
    src += 'getAggregateId(message){'
        + 'switch(message.type){'
        + agentModel.commands?.map((messageModel) =>
            `case ${compileMessageType(messageModel, agentModel, MessageKind.COMMANDS)}:`
            + `return message.payload${fromJsonPointer(messageModel.aggregateBy!).map((propertyName) => compilePropertyAccessor(propertyName))}`
        )
        + agentModel.adoptedEvents?.map((ref) =>
            `case ${compileMessageType(getReferencedMessageModel(agentModels, ref, MessageKind.COMMANDS), agentModel, MessageKind.COMMANDS)}:`
            + `return message.payload${fromJsonPointer(ref.aggregateBy!).map((propertyName) => compilePropertyAccessor(propertyName))}`
        )
        + '}},';
  }

  return src;
}

function getReferencedMessageModel(agentModels: Record<string, IAgentModel>, ref: IMessageRefModel, messageKind: MessageKind): IMessageModel {
  for (const agentModel of Object.values(agentModels)) {
    if (agentModel.name !== ref.from) {
      continue;
    }
    const messageModels = agentModel[messageKind] || die(`Agent "${agentModel.name}" doesn't declare ${messageKind}`);

    for (const messageModel of messageModels) {
      if (messageModel.type === ref.type) {
        return messageModel;
      }
    }
    die(`Cannot find referenced message "${ref.type}" among ${messageKind} of "${agentModel.name}" agent`);
  }
  die(`Cannot find referenced agent "${ref.from}"`);
}

export const agentModelsCompilerOptions: Required<IAgentModelsCompilerOptions> = {
  renameAgentInterface: (agentModel) => pascalCase(agentModel.name) + pascalCase(agentModel.type),
  renameAgentHandlerInterface: (agentModel) => pascalCase(agentModel.name) + 'Handler',
  renameAggregateStateInterface: (agentModel) => pascalCase(agentModel.name),
  renameAgentSingletonConst: (agentModel) => pascalCase(agentModel.name),
  renameMessageFactoryMethod: (messageModel) => camelCase(messageModel.type),
  renameMessageInterface: (messageModel) => pascalCase(messageModel.type),
  rewriteMessageType: (messageModel, agentModel) => agentModel.name + '.' + messageModel.type,
  renameMessageTypeEnum: (agentModel, messageKind) => pascalCase(agentModel.name) + pascalCase(messageKind) + 'Type',
  renameMessageUnionType: (agentModel, messageKind) => pascalCase(agentModel.name) + pascalCase(messageKind),
  renameAdoptedCommandUnionType: (agentModel) => pascalCase(agentModel.name) + 'AdoptedCommand',
  renameAdoptedEventUnionType: (agentModel) => pascalCase(agentModel.name) + 'AdoptedEvent',
  renameHandleCommand: (messageModel) => 'handle' + pascalCase(messageModel.type),
  renameHandleEvent: (messageModel) => 'apply' + pascalCase(messageModel.type),
  renameHandleAdoptedEvent: (messageModel, agentModel) => 'notice' + pascalCase(agentModel.name) + pascalCase(messageModel.type),
};
