import {IAgentModel, IMessageModel, IMessageRefModel} from './model-types';
import {camelCase, constantCase, pascalCase} from 'change-case-all';
import {AgentType} from '@event-sorcerer/runtime';
import {compileDocComment, compilePropertyAccessor} from '@smikhalevski/codegen';
import {createMap, die} from './misc';
import * as JsonPointer from 'json-pointer';
import {
  compileTypes,
  compileValidators,
  ITypesCompilerOptions,
  IValidatorsCompilerOptions,
  parseJtd,
  parseJtdRoot,
  TypeRefResolver,
  typesCompilerOptions,
  validatorDialectConfig,
} from '@jtdc/compiler';
import {IJtdDict, IJtdNodeDict, IJtdUnionNode, IValidatorDialectConfig, JtdNode, JtdNodeType} from '@jtdc/types';
import {validatorDialectFactory} from '@jtdc/jtd-dialect';

export const enum MessageKind {
  COMMAND = 'command',
  EVENT = 'event',
  ALERT = 'alert',
}

export type MessageRefResolver = (ref: IMessageRefModel, messageKind: MessageKind) => [IAgentModel, IMessageModel];

export interface IAgentModelsCompilerOptions
    extends ITypesCompilerOptions<unknown>,
            IValidatorsCompilerOptions<unknown, unknown>,
            Partial<IValidatorDialectConfig<unknown>> {

  /**
   * Returns the name of the interface that describes the message factory methods and extends an {@link IAgent}
   * interface.
   */
  renameAgentInterface?(agentModel: IAgentModel): string;

  /**
   * Returns the name of the namespace that contains agent message interfaces and message type enums.
   */
  renameAgentNamespace?(agentModel: IAgentModel): string;

  /**
   * Returns the name of the interface that describes agent message handlers.
   */
  renameAgentHandlerInterface?(agentModel: IAgentModel): string;

  /**
   * Returns the name of the interface that describes a state of a stateful agent.
   */
  renameAgentStateType?(agentModel: IAgentModel, node: JtdNode<unknown>): string;

  /**
   * Returns the name of the constant that contains an implementation the agent interface.
   *
   * @see renameAgentInterface
   */
  renameAgentSingletonConst?(agentModel: IAgentModel): string;

  /**
   * Returns the name of the method that creates a new message instance.
   *
   * @see renameAgentInterface
   */
  renameMessageFactoryMethod?(messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * Returns the name of the interface that describes the message and its payload.
   *
   * @see renameAgentNamespace
   */
  renameMessageInterface?(messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * Returns the value of the `type` filed of a message.
   *
   * **Important:** Message types must be unique application-wide.
   */
  rewriteMessageTypeValue?(messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * Returns the name of the enum that holds types of messages of particular kind.
   */
  renameMessageTypeEnum?(agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * Returns the name of the type alias that unions all message interfaces.
   */
  renameMessageTypeAlias?(agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * Returns the name of the type alias that unions all adopted message interfaces.
   */
  renameAdoptedMessageTypeAlias?(agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * Returns the name of the method that handles the command.
   */
  renameCommandHandlerMethod?(messageModel: IMessageModel, agentModel: IAgentModel): string;

  /**
   * Returns the name of the method that applies the event to the state of the stateful agent.
   */
  renameEventHandlerMethod?(messageModel: IMessageModel, agentModel: IAgentModel): string;

  /**
   * Returns the name of the method that handles the event that was dispatched by an other agent and adopted.
   */
  renameAdoptedEventHandlerMethod?(messageModel: IMessageModel, agentModel: IAgentModel): string;

  /**
   * Returns the name of the `Set` that contains message types.
   */
  renameMessageTypeSet?(agentModel: IAgentModel, messageKind: MessageKind): string;

  /**
   * Returns the name of the `Set` that contains adopted message types.
   */
  renameAdoptedMessageTypeSet?(agentModel: IAgentModel, messageKind: MessageKind): string;
}

export function compileAgentModel(agentModel: IAgentModel, messageRefResolver: MessageRefResolver, typeRefResolver: TypeRefResolver<unknown>, options: IAgentModelsCompilerOptions): string {
  const resolvedOptions = {...agentModelsCompilerOptions, ...options};

  const {
    renameType,
    renameUnionEnumKey,
    renameAgentInterface,
    renameAgentNamespace,
    renameAgentHandlerInterface,
    renameAgentStateType,
    renameAgentSingletonConst,
    renameMessageFactoryMethod,
    renameMessageInterface,
    renameMessageTypeEnum,
    renameMessageTypeAlias,
    renameAdoptedMessageTypeAlias,
    renameCommandHandlerMethod,
    renameEventHandlerMethod,
    renameAdoptedEventHandlerMethod,
    renameMessageTypeSet,
    renameAdoptedMessageTypeSet,
  } = resolvedOptions;

  const {
    type: agentType,
    name: agentName,
    state: stateJtd,
    commands: commandModels,
    events: eventModels,
    alerts: alertModels,
    adoptedCommands: adoptedCommandRefModels,
    adoptedEvents: adoptedEventRefModels,
    adoptedAlerts: adoptedAlertRefModels,
  } = agentModel;

  const stateful = agentType === AgentType.AGGREGATE || agentType === AgentType.PROCESS_MANAGER;

  const agentInterfaceName = renameAgentInterface(agentModel);
  const agentNamespaceName = renameAgentNamespace(agentModel);
  const agentHandlerInterfaceName = renameAgentHandlerInterface(agentModel);
  const agentStateTypeName = stateJtd ? renameAgentStateType(agentModel, parseJtd(stateJtd)) : 'never';
  const agentSingletonConstName = renameAgentSingletonConst(agentModel);

  const commandTypeAliasName = agentNamespaceName + '.' + renameMessageTypeAlias(agentModel, MessageKind.COMMAND);
  const eventTypeAliasName = agentNamespaceName + '.' + renameMessageTypeAlias(agentModel, MessageKind.EVENT);
  const alertTypeAliasName = agentNamespaceName + '.' + renameMessageTypeAlias(agentModel, MessageKind.ALERT);
  const adoptedCommandTypeAliasName = agentNamespaceName + '.' + renameAdoptedMessageTypeAlias(agentModel, MessageKind.COMMAND);
  const adoptedEventTypeAliasName = agentNamespaceName + '.' + renameAdoptedMessageTypeAlias(agentModel, MessageKind.EVENT);
  const adoptedAlertTypeAliasName = agentNamespaceName + '.' + renameAdoptedMessageTypeAlias(agentModel, MessageKind.ALERT);

  const commandTypeSetName = renameMessageTypeSet(agentModel, MessageKind.COMMAND);
  const eventTypeSetName = renameMessageTypeSet(agentModel, MessageKind.EVENT);
  const adoptedEventTypeSetName = renameAdoptedMessageTypeSet(agentModel, MessageKind.EVENT);

  const messageModelMap = [[MessageKind.COMMAND, commandModels], [MessageKind.EVENT, eventModels], [MessageKind.ALERT, alertModels]] as const;
  const messageRefModelMap = [[MessageKind.COMMAND, adoptedCommandRefModels], [MessageKind.EVENT, adoptedEventRefModels], [MessageKind.ALERT, adoptedAlertRefModels]] as const;

  const compileMessageInterfaceName = (messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind): string => {
    return renameAgentNamespace(agentModel) + '.' + renameMessageInterface(messageModel, agentModel, messageKind);
  };

  const compileMessageTypeValue = (messageModel: IMessageModel, agentModel: IAgentModel, messageKind: MessageKind) => {
    return renameAgentNamespace(agentModel)
        + '.' + renameMessageTypeEnum(agentModel, messageKind)
        + '.' + constantCase(messageModel.type);
  };

  let src = '';


  // region State
  if (stateJtd) {
    const definitions = parseJtdRoot(agentStateTypeName, stateJtd);

    src += compileTypes(definitions, typeRefResolver, {
      ...options,

      // Preserve the state type name
      renameType: (name, node) => node === definitions[agentStateTypeName] ? name : renameType(name, node),
    });
  }
  // endregion


  // region Agent handler interface
  src += 'export interface ' + agentHandlerInterfaceName;

  src += stateful ? ` extends IStatefulHandler<${agentStateTypeName}>{` : '{';

  // Handle events
  if (eventModels) {
    for (const messageModel of eventModels) {
      src += renameEventHandlerMethod(messageModel, agentModel)
          + ':EventCallback<'
          + compileMessageInterfaceName(messageModel, agentModel, MessageKind.EVENT)
          + ','
          + (stateful ? agentStateTypeName : 'void')
          +'>;'
    }
  }

  // Handle commands
  if (commandModels) {
    for (const messageModel of commandModels) {
      src += renameCommandHandlerMethod(messageModel, agentModel)
          + ':CommandCallback<'
          + compileMessageInterfaceName(messageModel, agentModel, MessageKind.COMMAND)
          + ','
          + eventTypeAliasName
          + (alertModels ? '|' + alertTypeAliasName : '')
          + ','
          + (stateful ? agentStateTypeName : 'void')
          + '>;';
    }
  }

  // Handle adopted events
  if (adoptedEventRefModels) {
    for (const ref of adoptedEventRefModels) {
      const [relatedAgentModel, relatedMessageModel] = messageRefResolver(ref, MessageKind.EVENT);

      src += renameAdoptedEventHandlerMethod(relatedMessageModel, relatedAgentModel)
          + ':AdoptedEventCallback<'
          + compileMessageInterfaceName(relatedMessageModel, relatedAgentModel, MessageKind.EVENT)
          + ','
          + adoptedCommandTypeAliasName
          + (commandModels ? '|' + commandTypeAliasName : '')
          + ','
          + (stateful ? agentStateTypeName : 'void')
          + '>;';
    }
  }

  src += '}';
  // endregion






  // region Message type sets

  // Event types
  if (eventModels) {
    src += `const ${eventTypeSetName}=new Set<string>([`
        + mapConcat(eventModels, (messageModel) => compileMessageTypeValue(messageModel, agentModel, MessageKind.EVENT), ',')
        + ']);';
  }

  // Command types
  if (commandModels) {
    src += `const ${commandTypeSetName}=new Set<string>([`
        + mapConcat(commandModels, (messageModel) => compileMessageTypeValue(messageModel, agentModel, MessageKind.COMMAND), ',')
        + ']);';
  }

  // Adopted event types
  if (adoptedEventRefModels) {
    src += `const ${adoptedEventTypeSetName}=new Set<string>(`
        + mapConcat(adoptedEventRefModels, (ref) => {
          const [relatedAgentModel, relatedMessageModel] = messageRefResolver(ref, MessageKind.EVENT);
          return compileMessageTypeValue(relatedMessageModel, relatedAgentModel, MessageKind.EVENT);
        }, ',')
        + ');';
  }

  // endregion


  // region Agent singleton

  src += `export const ${agentSingletonConstName}:`

  switch (agentType) {

    case AgentType.AGGREGATE:
      src += 'IAggregateAgent<'
          + agentStateTypeName
          + ',' + agentHandlerInterfaceName
          + ',' + commandTypeAliasName
          + ',' + eventTypeAliasName
          + ',' + (alertModels ? alertTypeAliasName : 'never')
          + '>';
      break;

    case AgentType.PROCESS_MANAGER:
      src += 'IProcessManagerAgent<'
          + agentStateTypeName
          + ',' + agentHandlerInterfaceName
          + ',' + commandTypeAliasName
          + ',' + eventTypeAliasName
          + ',' + (alertModels ? alertTypeAliasName : 'never')
          + ',' + (adoptedCommandRefModels ? adoptedCommandTypeAliasName : 'never')
          + ',' + (adoptedEventRefModels ? adoptedEventTypeAliasName : 'never')
          + '>';
      break;

    case AgentType.EVENT_LISTENER:
      src += 'IEventListenerAgent<'
          + agentHandlerInterfaceName
          + ',' + adoptedCommandTypeAliasName
          + ',' + adoptedEventTypeAliasName
          + '>';
      break;

    case AgentType.SERVICE:
      src += 'IServiceAgent<'
          + agentHandlerInterfaceName
          + ',' + (commandModels ? commandTypeAliasName : 'never')
          + ',' + (eventModels ? eventTypeAliasName : 'never')
          + ',' + (alertModels ? alertTypeAliasName : 'never')
          + '>';
      break;

    case AgentType.MONITOR:
      src += 'IMonitorAgent<'
          + agentHandlerInterfaceName
          + ',' + alertTypeAliasName
          + '>';
      break;
  }

  src += '={'
      + `type:AgentType.${constantCase(agentType)},`
      + `name:${JSON.stringify(agentName)},`;

  if (stateful) {

    // isSupportedEvent
    src += 'isSupportedEvent(message):message is '
        + eventTypeAliasName
        + `{return ${eventTypeSetName}.has(message.type)},`;

    // getAggregateId
    src += 'getAggregateId(message){'
        + 'switch(message.type){'
        + mapConcat(commandModels, (messageModel) =>
            `case ${compileMessageTypeValue(messageModel, agentModel, MessageKind.COMMAND)}:`
            + `return message.payload${compileAggregateBy(messageModel.aggregateBy)};`,
        )
        + mapConcat(adoptedEventRefModels, (ref) => {
          const [refAgentModel, refMessageModel] = messageRefResolver(ref, MessageKind.EVENT);

          return `case ${compileMessageTypeValue(refMessageModel, refAgentModel, MessageKind.EVENT)}:`
              + `return message.payload${compileAggregateBy(ref.aggregateBy)};`;
        })
        + '}},';

    // applyEvent
    src += `applyEvent(handler,event,state){`
        + 'switch(event.type){'
        + mapConcat(eventModels, (messageModel) =>
            `case ${compileMessageTypeValue(messageModel, agentModel, MessageKind.EVENT)}:`
            + `return handler.${renameEventHandlerMethod(messageModel, agentModel)}(event.payload,state);`,
        )
        + '}},';
  }

  if (commandModels) {

    // isSupportedCommand
    src += 'isSupportedCommand(message):message is '
        + commandTypeAliasName
        + `{return ${commandTypeSetName}.has(message.type)},`;

    // handleCommand
    src += `handleCommand(handler,command${stateful ? ',state' : ''}){`
        + 'switch(command.type){'
        + mapConcat(commandModels, (messageModel) =>
            `case ${compileMessageTypeValue(messageModel, agentModel, MessageKind.COMMAND)}:`
            + `return handler.${renameCommandHandlerMethod(messageModel, agentModel)}(command.payload${stateful ? ',state' : ''});`,
        )
        + '}},';
  }

  if (adoptedEventRefModels) {

    // isAdoptedEvent
    src += 'isAdoptedEvent(message):message is '
        + adoptedEventTypeAliasName
        + `{return ${adoptedEventTypeSetName}.has(message.type)},`;

    // handleAdoptedEvent
    src += `handleAdoptedEvent(handler,event${stateful ? ',state' : ''}){`
        + 'switch(event.type){'
        + mapConcat(adoptedEventRefModels, (ref) => {
          const [relatedAgentModel, relatedMessageModel] = messageRefResolver(ref, MessageKind.EVENT);

          return `case ${compileMessageTypeValue(relatedMessageModel, relatedAgentModel, MessageKind.EVENT)}:`
              + `return handler.${renameAdoptedEventHandlerMethod(relatedMessageModel, relatedAgentModel)}(command.payload${stateful ? ',state' : ''});`;
        })
        + '}},';
  }

  src += '};';
  // endregion


  return src;
}


export function compileMessageModels(agentModel: IAgentModel, messageRefResolver: MessageRefResolver, typeRefResolver: TypeRefResolver<unknown>, options: IAgentModelsCompilerOptions): string {

  let src = '';

  // Message factories
  for (const [messageKind, messageModels] of messageModelMap) {
    if (messageModels) {
      for (const messageModel of messageModels) {
        src += compileDocComment(messageModel.description)
            + 'export const '
            + renameMessageFactoryMethod(messageModel, agentModel, messageKind)
            + ':createMessageFactory<'
            + compileMessageInterfaceName(messageModel, agentModel, messageKind)
            + '>('
            + compileMessageTypeValue(messageModel, agentModel, messageKind)
            + '),';
      }
    }
  }

  // Message interfaces
  for (const [messageKind, messageModels] of messageModelMap) {
    if (messageModels) {
      src += compileMessageInterfaces(agentModel, messageModels, messageKind, typeRefResolver, resolvedOptions);
    }
  }

  // Message validators
  src += compileValidators(createMessageDefinitions(messageModels), validatorDialectFactory(resolvedOptions), resolvedOptions);

  // Adopted message type aliases
  for (const [messageKind, refs] of messageRefModelMap) {
    if (refs) {
      for (const ref of refs) {
        src += 'export type '
            + renameAdoptedMessageTypeAlias(agentModel, messageKind)
            + '='
            + mapConcat(refs, (ref) => {
              const [relatedAgentModel, relatedMessageModel] = messageRefResolver(ref, messageKind);
              return '|' + renameMessageInterface(relatedMessageModel, relatedAgentModel, messageKind);
            })
            + ';';
      }
    }
  }

  return src;
}

function createMessageDefinitions(messageModels: Array<IMessageModel>): IJtdNodeDict<unknown> {
  return messageModels.reduce((definitions, messageModel) => Object.assign(definitions, {
    [messageModel.type]: parseJtd(messageModel.payload),
  }), {});
}

function createMessagesUnionNode(messageModels: Array<IMessageModel>): IJtdUnionNode<unknown> {
  const node = parseJtd({
    discriminator: 'type',
    mapping: messageModels.reduce((mapping, messageModel) => Object.assign(mapping, {
      [messageModel.type]: {
        properties: {
          payload: messageModel.payload,
        },
      },
    }), {}),
  });
  return node.nodeType === JtdNodeType.UNION ? node : die('Unexpected node type');
}

function compileMessageInterfaces(agentModel: IAgentModel, messageModels: Array<IMessageModel>, messageKind: MessageKind, typeRefResolver: TypeRefResolver<unknown>, options: Required<IAgentModelsCompilerOptions>): string {
  const {
    renameUnionEnum,
    renameType,
    renameMappingInterface,
    rewriteMappingKey,
    renameMessageTypeEnum,
    renameMessageInterface,
    rewriteMessageTypeValue,
    renameMessageTypeAlias,
  } = options;

  const messagesUnionNode = createMessagesUnionNode(messageModels);

  return compileTypes({[messageKind]: messagesUnionNode}, typeRefResolver, {
    ...options,

    renameUnionEnum(name, node) {
      if (node === messagesUnionNode) {
        return renameMessageTypeEnum(agentModel, messageKind);
      } else {
        return renameUnionEnum(name, node);
      }
    },
    renameType(name, node) {
      if (node === messagesUnionNode) {
        return renameMessageTypeAlias(agentModel, messageKind);
      } else {
        return renameType(name, node);
      }
    },
    renameMappingInterface(mappingKey, mappingNode, unionName, unionNode) {
      if (unionNode === messagesUnionNode) {
        return renameMessageInterface(getMessageByType(mappingKey, messageModels)!, agentModel, messageKind);
      } else {
        return renameMappingInterface(mappingKey, mappingNode, unionName, unionNode);
      }
    },
    rewriteMappingKey(mappingKey, mappingNode, unionName, unionNode) {
      if (unionNode === messagesUnionNode) {
        return rewriteMessageTypeValue(getMessageByType(mappingKey, messageModels)!, agentModel, messageKind);
      } else {
        return rewriteMappingKey(mappingKey, mappingNode, unionName, unionNode);
      }
    },
  });
}

function compileAggregateBy(aggregateBy: string | undefined): string {
  return mapConcat(JsonPointer.parse(aggregateBy || die('Missing aggregateBy')), (propertyName) => compilePropertyAccessor(propertyName));
}

function getMessageByType(type: string, messageModels: Array<IMessageModel>): IMessageModel | undefined {
  for (const messageModel of messageModels) {
    if (messageModel.type === type) {
      return messageModel;
    }
  }
}

function mapConcat<T>(arr: Array<T> | undefined, iteratee: (value: T, index: number) => string, separator = ''): string {
  return arr ? arr.map(iteratee).join(separator) : '';
}

export const agentModelsCompilerOptions: Required<IAgentModelsCompilerOptions> = {
  ...typesCompilerOptions,
  ...validatorDialectConfig,

  typeGuardsRendered: true,

  renameAgentInterface: (agentModel) => pascalCase(agentModel.name) + 'Agent',
  renameAgentNamespace: (agentModel) => pascalCase(agentModel.name) + 'Messages',
  renameAgentHandlerInterface: (agentModel) => pascalCase(agentModel.name) + 'Handler',
  renameAgentStateType: (agentModel) => pascalCase(agentModel.name) + 'State',
  renameAgentSingletonConst: (agentModel) => pascalCase(agentModel.name) + 'Agent',
  renameMessageFactoryMethod: (messageModel) => camelCase(messageModel.type),
  renameMessageInterface: (messageModel) => pascalCase(messageModel.type),
  rewriteMessageTypeValue: (messageModel, agentModel) => agentModel.name + '.' + messageModel.type,
  renameMessageTypeEnum: (agentModel, messageKind) => pascalCase(messageKind) + 'Type',
  renameMessageTypeAlias: (agentModel, messageKind) => pascalCase(messageKind),
  renameAdoptedMessageTypeAlias: (agentModel, messageKind) => 'Adopted' + pascalCase(messageKind),
  renameCommandHandlerMethod: (messageModel) => 'handle' + pascalCase(messageModel.type),
  renameEventHandlerMethod: (messageModel) => 'apply' + pascalCase(messageModel.type),
  renameAdoptedEventHandlerMethod: (messageModel, agentModel) => 'capture' + pascalCase(agentModel.name) + pascalCase(messageModel.type),
  renameMessageTypeSet: (agentModel, messageKind) => camelCase(messageKind) + 'Types',
  renameAdoptedMessageTypeSet: (agentModel, messageKind) => 'adopted' + pascalCase(messageKind) + 'Types',
};
