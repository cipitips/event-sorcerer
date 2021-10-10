import {IAgentModel, IMessageModel, IMessageRefModel} from './model-types';
import {camelCase, constantCase, pascalCase} from 'change-case-all';
import {AgentType} from '@event-sorcerer/runtime';
import {compileDocComment, compilePropertyAccessor} from '@smikhalevski/codegen';
import {createMap, die} from './misc';
import * as JsonPointer from 'json-pointer';
import {
  compileTypes,
  ITypesCompilerOptions,
  parseJtd,
  parseJtdRoot,
  RefResolver,
  typesCompilerOptions,
} from '@jtdc/compiler';
import {IJtdDict, JtdNode} from '@jtdc/types';

const throwRefResolver: RefResolver<unknown> = (node) => die('Unresolved reference: ' + node.ref);

export enum MessageKind {
  COMMAND = 'command',
  EVENT = 'event',
  ALERT = 'alert',
}

export interface IAgentModelsCompilerOptions extends ITypesCompilerOptions<unknown> {

  /**
   * The interface that describes the message factory methods and extends {@link IAggregateAgent},
   * {@link IProcessManagerAgent}, {@link IEventListenerAgent} or {@link IServiceAgent}. Implementation of this
   * interface is generated (see {@link renameAgentSingletonConst}).
   */
  renameAgentInterface?(agentModel: IAgentModel): string;

  /**
   * The namespace that contains interfaces of messages that belong to an agent.
   */
  renameAgentNamespace?(agentModel: IAgentModel): string;

  /**
   * The interface that describes the message handlers of the agent. This interface should be manually implemented and
   * is intended to contain application business logic. If agent is stateful then this interface extends
   * {@link IStatefulHandler}.
   */
  renameAgentHandlerInterface?(agentModel: IAgentModel): string;

  /**
   * The interface that describes a state of a stateful agent.
   */
  renameAgentStateType?(agentModel: IAgentModel, node: JtdNode<unknown>): string;

  /**
   * The singleton that implements the agent interface (see {@link renameAgentInterface}).
   */
  renameAgentSingletonConst?(agentModel: IAgentModel): string;

  /**
   * The method that creates a new message instance. This method is rendered inside the agent interface (see
   * {@link renameAgentInterface}).
   */
  renameMessageFactoryMethod?(messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * The interface that describes the message and its payload. This interface is rendered inside the agent namespace
   * (see {@link renameAgentNamespace}).
   */
  renameMessageInterface?(messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * The string that is used as the message type.
   *
   * **Important:** Message types must be unique application-wide.
   */
  rewriteMessageType?(messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * The enum that holds agent message types of particular kind.
   */
  renameMessageTypeEnum?(agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * The type alias that unions all message interfaces (see {@link renameMessageInterface}) of particular kind. This
   * type alias is rendered inside the agent namespace (see {@link renameAgentNamespace}).
   */
  renameMessageUnionTypeAlias?(agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * Same as {@link renameMessageUnionTypeAlias} but for messages adopted from other agents. This type alias is
   * rendered inside the agent namespace (see {@link renameAgentNamespace}).
   */
  renameAdoptedMessageUnionTypeAlias?(agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * The method that handles the command. This method is rendered inside the agent handler (see
   * {@link renameAgentHandlerInterface}).
   */
  renameCommandHandlerMethod?(messageModel: IMessageModel, agentModel: IAgentModel): string;

  /**
   * The method that applies the event to the state of the stateful agent during aggregate hydration phase. This method
   * is rendered inside the agent handler (see {@link renameAgentHandlerInterface}).
   */
  renameEventHandlerMethod?(messageModel: IMessageModel, agentModel: IAgentModel): string;

  /**
   * The method that handles the event that was dispatched by other agent. This method is rendered inside the agent
   * handler (see {@link renameAgentHandlerInterface}).
   */
  renameAdoptedEventHandlerMethod?(messageModel: IMessageModel, agentModel: IAgentModel): string;

  renameMessageTypeSet?(agentModel: IAgentModel, messageKind: MessageKind): string;

  renameAdoptedMessageTypeSet?(agentModel: IAgentModel, messageKind: MessageKind): string;
}

export function compileAgentModels(agentModels: Record<string, IAgentModel>, options?: IAgentModelsCompilerOptions): Record<string, string> {
  const resolvedOptions = {...agentModelsCompilerOptions, ...options};

  const sourceMap = createMap<string>();

  for (const [filePath, agentModel] of Object.entries(agentModels)) {
    sourceMap[filePath] = compileAgentModel(filePath, agentModels, agentModel, resolvedOptions);
  }
  return sourceMap;
}

function compileAgentModel(filePath: string, agentModels: Record<string, IAgentModel>, agentModel: IAgentModel, options: Required<IAgentModelsCompilerOptions>): string {

  const {
    renameType,
    renameAgentInterface,
    renameAgentNamespace,
    renameAgentHandlerInterface,
    renameAgentStateType,
    renameAgentSingletonConst,
    renameMessageFactoryMethod,
    renameMessageInterface,
    renameMessageTypeEnum,
    renameMessageUnionTypeAlias,
    renameAdoptedMessageUnionTypeAlias,
    renameCommandHandlerMethod,
    renameEventHandlerMethod,
    renameAdoptedEventHandlerMethod,
    renameMessageTypeSet,
    renameAdoptedMessageTypeSet,
  } = options;

  let src = '';

  const agentName = agentModel.name || die(`Agent doesn't have a name in ${filePath}`);
  const agentType = agentModel.type || die(`Agent "${agentName}" doesn't have a type`);

  const agentState = agentModel.state;
  const agentCommands = agentModel.commands;
  const agentEvents = agentModel.events;
  const agentAlerts = agentModel.alerts;
  const agentAdoptedEvents = agentModel.adoptedEvents;
  const agentAdoptedCommands = agentModel.adoptedCommands;

  const stateful = agentType === AgentType.AGGREGATE || agentType === AgentType.PROCESS_MANAGER;

  const agentTypeName = renameAgentInterface(agentModel);
  const agentNamespace = renameAgentNamespace(agentModel);
  const agentHandlerTypeName = renameAgentHandlerInterface(agentModel);
  const agentStateTypeName = agentState ? renameAgentStateType(agentModel, parseJtd(agentState)) : 'never';
  const agentSingletonName = renameAgentSingletonConst(agentModel);

  const commandTypeName = renameMessageUnionTypeAlias(agentModel, MessageKind.COMMAND);
  const eventTypeName = renameMessageUnionTypeAlias(agentModel, MessageKind.EVENT);
  const alertTypeName = renameMessageUnionTypeAlias(agentModel, MessageKind.ALERT);
  const adoptedCommandTypeName = renameAdoptedMessageUnionTypeAlias(agentModel, MessageKind.COMMAND);
  const adoptedEventTypeName = renameAdoptedMessageUnionTypeAlias(agentModel, MessageKind.EVENT);

  const commandTypeSetName = renameMessageTypeSet(agentModel, MessageKind.COMMAND);
  const eventTypeSetName = renameMessageTypeSet(agentModel, MessageKind.EVENT);
  const adoptedEventTypeSetName = renameAdoptedMessageTypeSet(agentModel, MessageKind.EVENT);

  const compileNamespacedType = (typeName: string) => agentNamespace + '.' + typeName;

  const compileMessageType = (messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind) =>
      compileNamespacedType(renameMessageTypeEnum(agentModel, messageKind) + '.' + constantCase(messageModel.type));


  // region State
  if (agentState) {
    const definitions = parseJtdRoot(agentStateTypeName, agentState);

    src += compileTypes(definitions, throwRefResolver, {
      ...options,

      // Preserve the state type name
      renameType: (name, node) => node === definitions[agentStateTypeName] ? name : renameType(name, node),
    });
  }
  // endregion


  // region Agent
  switch (agentType) {

    case AgentType.AGGREGATE:
      src += `export interface ${agentTypeName} extends IAggregateAgent<`
          + agentStateTypeName
          + ',' + agentHandlerTypeName
          + ',' + compileNamespacedType(commandTypeName)
          + ',' + compileNamespacedType(eventTypeName)
          + ',' + (agentAlerts ? compileNamespacedType(alertTypeName) : 'never')
          + '>{';
      break;

    case AgentType.PROCESS_MANAGER:
      src += `export interface ${agentTypeName} extends IProcessManagerAgent<`
          + agentStateTypeName
          + ',' + agentHandlerTypeName
          + ',' + compileNamespacedType(commandTypeName)
          + ',' + compileNamespacedType(eventTypeName)
          + ',' + (agentAlerts ? compileNamespacedType(alertTypeName) : 'never')
          + ',' + (agentAdoptedCommands ? compileNamespacedType(adoptedCommandTypeName) : 'never')
          + ',' + (agentAdoptedEvents ? compileNamespacedType(adoptedEventTypeName) : 'never')
          + '>{';
      break;

    case AgentType.EVENT_LISTENER:
      src += `export interface ${agentTypeName} extends IEventListenerAgent<`
          + agentHandlerTypeName
          + ',' + compileNamespacedType(adoptedCommandTypeName)
          + ',' + compileNamespacedType(adoptedEventTypeName)
          + '>{';
      break;

    case AgentType.SERVICE:
      src += `export interface ${agentTypeName} extends IServiceAgent<`
          + agentHandlerTypeName
          + ',' + (agentCommands ? compileNamespacedType(commandTypeName) : 'never')
          + ',' + (agentEvents ? compileNamespacedType(eventTypeName) : 'never')
          + ',' + (agentAlerts ? compileNamespacedType(alertTypeName) : 'never')
          + '>{';
      break;
  }

  // Command factories
  if (agentCommands) {
    for (const messageModel of agentCommands) {
      const messageTypeName = compileNamespacedType(renameMessageInterface(messageModel, agentModel, MessageKind.COMMAND));

      src += compileDocComment(messageModel.description)
          + renameMessageFactoryMethod(messageModel, agentModel, MessageKind.COMMAND)
          + `(payload:${messageTypeName}['payload']):${messageTypeName};`;
    }
  }

  // Event factories
  if (agentEvents) {
    for (const messageModel of agentEvents) {
      const messageTypeName = compileNamespacedType(renameMessageInterface(messageModel, agentModel, MessageKind.EVENT));

      src += compileDocComment(messageModel.description)
          + renameMessageFactoryMethod(messageModel, agentModel, MessageKind.EVENT)
          + `(payload:${messageTypeName}['payload']):${messageTypeName};`;
    }
  }

  // Alert factories
  if (agentAlerts) {
    for (const messageModel of agentAlerts) {
      const messageTypeName = compileNamespacedType(renameMessageInterface(messageModel, agentModel, MessageKind.ALERT));

      src += compileDocComment(messageModel.description)
          + renameMessageFactoryMethod(messageModel, agentModel, MessageKind.ALERT)
          + `(payload:${messageTypeName}['payload']):${messageTypeName};`;
    }
  }

  src += '}';
  // endregion


  // region Agent handler
  src += 'export interface ' + agentHandlerTypeName;

  src += stateful ? ` extends IStatefulHandler<${agentStateTypeName}>{` : '{';

  // Handle adopted events
  if (agentAdoptedEvents) {
    for (const ref of agentAdoptedEvents) {
      const [relatedAgentModel, relatedMessageModel] = getReferencedMessageModel(agentModels, ref, MessageKind.EVENT);

      src += renameAdoptedEventHandlerMethod(relatedMessageModel, relatedAgentModel)
          + `(payload:${compileNamespacedType(renameMessageInterface(relatedMessageModel, relatedAgentModel, MessageKind.EVENT))}['payload'])`
          + ':Awaitable<Maybe<ReadonlyMany<'
          + compileNamespacedType(adoptedCommandTypeName)
          + (agentCommands ? '|' + compileNamespacedType(commandTypeName) : '')
          + '>>>;';
    }
  }

  // Handle commands
  if (agentCommands) {
    for (const messageModel of agentCommands) {
      src += renameCommandHandlerMethod(messageModel, agentModel)
          + '('
          + `payload:${compileNamespacedType(renameMessageInterface(messageModel, agentModel, MessageKind.COMMAND))}['payload']`
          + (stateful ? `,state:Readonly<${agentStateTypeName}>` : '')
          + ')'
          + ':Awaitable<ReadonlyMany<'
          + compileNamespacedType(eventTypeName)
          + (agentAlerts ? '|' + compileNamespacedType(alertTypeName) : '')
          + '>>;';
    }
  }

  // Handle events
  if (agentEvents) {
    for (const messageModel of agentEvents) {
      src += renameEventHandlerMethod(messageModel, agentModel)
          + '('
          + `payload:${compileNamespacedType(renameMessageInterface(messageModel, agentModel, MessageKind.EVENT))}['payload']`
          + (stateful ? `,state:${agentStateTypeName}` : '')
          + ')'
          + `:Awaitable<void>;`;
    }
  }

  src += '}';
  // endregion


  // region Namespace
  src += `export namespace ${agentNamespace}{`;

  // Commands
  if (agentCommands) {
    src += compileMessageInterfaces(agentModel, agentCommands, MessageKind.COMMAND, options);
  }

  // Events
  if (agentEvents) {
    src += compileMessageInterfaces(agentModel, agentEvents, MessageKind.EVENT, options);
  }

  // Adopted commands
  if (agentAdoptedCommands) {
    src += `export type ${adoptedCommandTypeName}=`
        + mapConcat(agentAdoptedCommands, (ref) => {
          const [relatedAgentModel, relatedMessageModel] = getReferencedMessageModel(agentModels, ref, MessageKind.COMMAND);
          return renameMessageInterface(relatedMessageModel, relatedAgentModel, MessageKind.COMMAND);
        }, '|')
        + ';';
  }

  // Adopted events
  if (agentAdoptedEvents) {
    src += `export type ${adoptedEventTypeName}=`
        + mapConcat(agentAdoptedEvents, (ref) => {
          const [relatedAgentModel, relatedMessageModel] = getReferencedMessageModel(agentModels, ref, MessageKind.EVENT);
          return renameMessageInterface(relatedMessageModel, relatedAgentModel, MessageKind.EVENT);
        }, '|')
        + ';';
  }

  src += '}';
  // endregion


  // region Constants

  // Event types
  if (agentEvents) {
    src += `const ${eventTypeSetName}=new Set<string>([`
        + mapConcat(agentEvents, (messageModel) => compileMessageType(messageModel, agentModel, MessageKind.EVENT), ',')
        + ']);';
  }

  // Command types
  if (agentCommands) {
    src += `const ${commandTypeSetName}=new Set<string>([`
        + mapConcat(agentCommands, (messageModel) => compileMessageType(messageModel, agentModel, MessageKind.COMMAND), ',')
        + ']);';
  }

  // Adopted event types
  if (agentAdoptedEvents) {
    src += `const ${adoptedEventTypeSetName}=new Set<string>(`
        + mapConcat(agentAdoptedEvents, (ref) => {
          const [relatedAgentModel, relatedMessageModel] = getReferencedMessageModel(agentModels, ref, MessageKind.EVENT);
          return compileMessageType(relatedMessageModel, relatedAgentModel, MessageKind.EVENT);
        }, ',')
        + ');';
  }
  // endregion


  // region Singleton
  src += `export const ${agentSingletonName}:${agentTypeName}={`
      + `type:AgentType.${constantCase(agentType)},`
      + `name:${JSON.stringify(agentName)},`;

  // Command factories
  if (agentCommands) {
    for (const messageModel of agentCommands) {
      src += renameMessageFactoryMethod(messageModel, agentModel, MessageKind.COMMAND)
          + `(payload){return{type:${compileMessageType(messageModel, agentModel, MessageKind.COMMAND)},payload};},`;
    }
  }

  // Event factories
  if (agentEvents) {
    for (const messageModel of agentEvents) {
      src += renameMessageFactoryMethod(messageModel, agentModel, MessageKind.EVENT)
          + `(payload){return{type:${compileMessageType(messageModel, agentModel, MessageKind.EVENT)},payload};},`;
    }
  }

  // Alert factories
  if (agentAlerts) {
    for (const messageModel of agentAlerts) {
      src += renameMessageFactoryMethod(messageModel, agentModel, MessageKind.ALERT)
          + `(payload){return{type:${compileMessageType(messageModel, agentModel, MessageKind.ALERT)},payload};},`;
    }
  }

  if (stateful) {

    // isSupportedEvent
    src += 'isSupportedEvent(message):message is '
        + compileNamespacedType(eventTypeName)
        + `{return ${eventTypeSetName}.has(message.type)},`;

    // getAggregateId
    src += 'getAggregateId(message){'
        + 'switch(message.type){'
        + mapConcat(agentCommands, (messageModel) =>
            `case ${compileMessageType(messageModel, agentModel, MessageKind.COMMAND)}:`
            + `return message.payload${compileAggregateBy(messageModel.aggregateBy)};`,
        )
        + mapConcat(agentAdoptedEvents, (ref) => {
          const [relatedAgentModel, relatedMessageModel] = getReferencedMessageModel(agentModels, ref, MessageKind.EVENT);

          return `case ${compileMessageType(relatedMessageModel, relatedAgentModel, MessageKind.EVENT)}:`
              + `return message.payload${compileAggregateBy(ref.aggregateBy)};`;
        })
        + '}},';
  }

  if (agentCommands) {

    // isSupportedCommand
    src += 'isSupportedCommand(message):message is '
        + compileNamespacedType(commandTypeName)
        + `{return ${commandTypeSetName}.has(message.type)},`;

    // handleCommand
    src += `handleCommand(handler,command${stateful ? ',state' : ''}){`
        + 'switch(command.type){'
        + mapConcat(agentCommands, (messageModel) =>
            `case ${compileMessageType(messageModel, agentModel, MessageKind.COMMAND)}:`
            + `return handler.${renameCommandHandlerMethod(messageModel, agentModel)}(command.payload${stateful ? ',state' : ''});`,
        )
        + '}},';
  }

  if (agentEvents) {

    // applyEvent
    src += `applyEvent(handler,event${stateful ? ',state' : ''}){`
        + 'switch(event.type){'
        + mapConcat(agentEvents, (messageModel) =>
            `case ${compileMessageType(messageModel, agentModel, MessageKind.EVENT)}:`
            + `return handler.${renameEventHandlerMethod(messageModel, agentModel)}(event.payload${stateful ? ',state' : ''});`
        )
        + '}},';
  }

  if (agentAdoptedEvents) {

    // isAdoptedEvent
    src += 'isAdoptedEvent(message):message is '
        + compileNamespacedType(adoptedEventTypeName)
        + `{return ${adoptedEventTypeSetName}.has(message.type)},`;

    // handleAdoptedEvent
    src += 'handleAdoptedEvent(handler,event){'
        + 'switch(event.type){'
        + mapConcat(agentAdoptedEvents, (ref) => {
          const [relatedAgentModel, relatedMessageModel] = getReferencedMessageModel(agentModels, ref, MessageKind.EVENT);

          return `case ${compileMessageType(relatedMessageModel, relatedAgentModel, MessageKind.EVENT)}:`
              + `return handler.${renameAdoptedEventHandlerMethod(relatedMessageModel, relatedAgentModel)}(command.payload);`;
        })
        + '}},';
  }

  src += '};';
  // endregion

  return src;
}

function compileMessageInterfaces(agentModel: IAgentModel, messageModels: Array<IMessageModel>, messageKind: MessageKind, options: Required<IAgentModelsCompilerOptions>): string {
  const {
    renameUnionEnum,
    renameType,
    renameMappingInterface,
    rewriteMappingKey,
    renameMessageTypeEnum,
    renameMessageInterface,
    rewriteMessageType,
    renameMessageUnionTypeAlias,
  } = options;

  const messagesNode = parseJtd({
    discriminator: 'type',
    mapping: messageModels.reduce<IJtdDict<unknown>>((mapping, messageModel) => Object.assign(mapping, {
      [messageModel.type]: {
        properties: {
          payload: messageModel.payload,
        },
      },
    }), {}),
  });

  return compileTypes({[messageKind]: messagesNode}, throwRefResolver, {
    renameUnionEnum: (name, node) => node === messagesNode ? renameMessageTypeEnum(agentModel, messageKind) : renameUnionEnum(name, node),
    renameType: (name, node) => node === messagesNode ? renameMessageUnionTypeAlias(agentModel, messageKind) : renameType(name, node),
    renameMappingInterface: (mappingKey, mappingNode, unionName, unionNode) => unionNode === messagesNode ? renameMessageInterface(getMessageByType(mappingKey, messageModels)!, agentModel, messageKind) : renameMappingInterface(mappingKey, mappingNode, unionName, unionNode),
    rewriteMappingKey: (mappingKey, mappingNode, unionName, unionNode) => unionNode === messagesNode ? rewriteMessageType(getMessageByType(mappingKey, messageModels)!, agentModel, messageKind) : rewriteMappingKey(mappingKey, mappingNode, unionName, unionNode),
  });
}

function getMessageByType(type: string, messageModels: Array<IMessageModel>): IMessageModel | undefined {
  for (const messageModel of messageModels) {
    if (messageModel.type === type) {
      return messageModel;
    }
  }
}

function getReferencedMessageModel(agentModels: Record<string, IAgentModel>, ref: IMessageRefModel, messageKind: MessageKind): [IAgentModel, IMessageModel] {
  for (const agentModel of Object.values(agentModels)) {
    if (agentModel.name !== ref.from) {
      continue;
    }
    const messageModels = agentModel[pluralMessageKinds[messageKind]] || die(`Agent "${agentModel.name}" doesn't declare ${pluralMessageKinds[messageKind]}`);
    const messageModel = getMessageByType(ref.type, messageModels) || die(`Message "${ref.type}" wasn't found among ${pluralMessageKinds[messageKind]} of "${agentModel.name}" agent`);

    return [agentModel, messageModel];
  }
  die(`Agent "${ref.from}" wasn't found`);
}

function mapConcat<T>(arr: Array<T> | undefined, iteratee: (value: T, index: number) => string, separator = ''): string {
  return arr ? arr.map(iteratee).join(separator) : '';
}

function compileAggregateBy(aggregateBy: string | undefined): string {
  return JsonPointer.parse(aggregateBy || die('Missing aggregateBy')).map((propertyName) => compilePropertyAccessor(propertyName)).join('');
}

const pluralMessageKinds = {
  [MessageKind.COMMAND]: 'commands',
  [MessageKind.EVENT]: 'events',
  [MessageKind.ALERT]: 'alerts',
} as const;

export const agentModelsCompilerOptions: Required<IAgentModelsCompilerOptions> = {
  ...typesCompilerOptions,

  renameAgentInterface: (agentModel) => pascalCase(agentModel.name) + 'Agent',
  renameAgentNamespace: (agentModel) => pascalCase(agentModel.name) + 'Agent',
  renameAgentHandlerInterface: (agentModel) => pascalCase(agentModel.name) + 'Handler',
  renameAgentStateType: (agentModel) => pascalCase(agentModel.name),
  renameAgentSingletonConst: (agentModel) => pascalCase(agentModel.name),
  renameMessageFactoryMethod: (messageModel) => camelCase(messageModel.type),
  renameMessageInterface: (messageModel) => pascalCase(messageModel.type),
  rewriteMessageType: (messageModel, agentModel) => agentModel.name + '.' + messageModel.type,
  renameMessageTypeEnum: (agentModel, messageKind) => pascalCase(messageKind) + 'Type',
  renameMessageUnionTypeAlias: (agentModel, messageKind) => pascalCase(messageKind),
  renameAdoptedMessageUnionTypeAlias: (agentModel, messageKind) => 'Adopted' + pascalCase(messageKind),
  renameCommandHandlerMethod: (messageModel) => 'handle' + pascalCase(messageModel.type),
  renameEventHandlerMethod: (messageModel) => 'apply' + pascalCase(messageModel.type),
  renameAdoptedEventHandlerMethod: (messageModel, agentModel) => 'capture' + pascalCase(agentModel.name) + pascalCase(messageModel.type),
  renameMessageTypeSet: (agentModel, messageKind) => camelCase(messageKind) + 'Types',
  renameAdoptedMessageTypeSet: (agentModel, messageKind) => 'adopted' + pascalCase(messageKind) + 'Types',
};
