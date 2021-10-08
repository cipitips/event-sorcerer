import {IAgentNode, IMessageNode} from './model-ast-types';
import {AgentType} from './model-types';
import {
  compileAccessor,
  compileDocComment,
  compileTsFromJtdDefinitions,
  IJtd,
  ITsJtdMetadata,
  JtdNode,
  parseJtd,
  pascalCase,
  upperSnakeCase,
} from '@jtdc/types';
import {camelCase} from 'lodash';
import {Arrays, Many} from '@smikhalevski/stdlib';

export interface IHandlerTsOptions {
  renameInterface: (name: string) => string;
  renameType: (name: string) => string;
  renameVar: (name: string) => string;
  renameEnum: (name: string) => string;
  renameEnumValue: (name: string) => string;
}

export function compileTsFromHandlers(handlerNodes: Map<string, IAgentNode>, options?: Partial<IHandlerTsOptions>): string {
  let source = '';
  handlerNodes.forEach((handlerNode) => source += compileTsFromHandler(handlerNode, options));
  return source;
}

export function compileTsFromHandler(handler: IAgentNode, options?: Partial<IHandlerTsOptions>): string {
  const allOptions = {...handlerTsOptions, ...options};

  const {
    renameInterface,
    renameType,
    renameVar,
    renameEnum,
    renameEnumValue,
  } = allOptions;

  const stateful = handler.type === AgentType.AGGREGATE || handler.type === AgentType.PROCESS_MANAGER;

  const typeName = renameInterface(concat(handler.name, handler.type)); // IFooService
  const handlerTypeName = renameInterface(concat(handler.name, handler.type, 'Handler')); // IFooServiceHandler
  const stateTypeName = renameInterface(handler.name); // IFoo

  const commandTypeName = handler.commands.size ? renameType(concat(handler.name, 'Command')) : 'never'; // FooCommand
  const eventTypeName = handler.events.size ? renameType(concat(handler.name, 'Event')) : 'never'; // FooEvent
  const alertTypeName = handler.alerts.size ? renameType(concat(handler.name, 'Alert')) : 'never'; // FooAlert
  const adoptedCommandTypeName = handler.adoptedCommands.size ? renameType(concat(handler.name, 'AdoptedCommand')) : 'never'; // FooAdoptedCommand
  const adoptedEventTypeName = handler.adoptedEvents.size ? renameType(concat(handler.name, 'AdoptedEvent')) : 'never'; // FooAdoptedEvent

  const renameMessageInterface = (message: IMessageNode) => renameInterface(concat(message.handler.name, message.type));
  const compileMessageType = (message: IMessageNode) => renameEnum(concat(message.handler.name, message.kind, 'Type')) + '.' + renameEnumValue(message.type);

  let source = '';

  switch (handler.type) {

    case AgentType.AGGREGATE:
      source += `export interface ${typeName} extends IAggregate<`
          + stateTypeName + ','
          + handlerTypeName + ','
          + commandTypeName + ','
          + eventTypeName + ','
          + alertTypeName
          + '>{';
      break;

    case AgentType.PROCESS_MANAGER:
      source += `export interface ${typeName} extends IProcessManager<`
          + stateTypeName + ','
          + handlerTypeName + ','
          + commandTypeName + ','
          + eventTypeName + ','
          + alertTypeName + ','
          + adoptedCommandTypeName + ','
          + adoptedEventTypeName
          + '>{';
      break;

    case AgentType.EVENT_LISTENER:
      source += `export interface ${typeName} extends IEventListener<`
          + handlerTypeName + ','
          + adoptedCommandTypeName + ','
          + adoptedEventTypeName
          + '>{';
      break;

    case AgentType.SERVICE:
      source += `export interface ${typeName} extends IService<`
          + handlerTypeName + ','
          + commandTypeName + ','
          + eventTypeName + ','
          + alertTypeName
          + '>{';
      break;
  }

  source += mapConcat([handler.commands, handler.events, handler.alerts], (message) => (
      compileDocComment(message.description)
      + renameVar(message.type)
      + `(payload:Payload<${renameMessageInterface(message)}>):${renameMessageInterface(message)};`
  ));

  source += '}';


  // Handler

  source += 'export interface ' + handlerTypeName;

  source += stateful ? ` extends IAggregateHandler<${stateTypeName}>{` : '{';

  // Notice adopted events
  source += mapConcat(handler.adoptedEvents, (ref) => (
      renameVar(concat('notice', ref.message.handler.name, ref.message.type))
      + `(payload:Payload<${renameMessageInterface(ref.message)}>`
      + `:Awaitable<Maybe<ReadonlyMany<${adoptedCommandTypeName}>>>;`
  ));

  // Handle commands
  source += mapConcat(handler.commands, (message) => (
      renameVar(concat('handle', message.type))
      + `(payload:Payload<${renameMessageInterface(message)}>${stateful ? `,state:Readonly<${stateTypeName}>` : ''})`
      + `:Awaitable<ReadonlyMany<${eventTypeName}>>;`
  ));

  // Apply events
  source += mapConcat(handler.events, (message) => (
      renameVar(concat('apply', message.type))
      + `(payload:Payload<${renameMessageInterface(message)}>${stateful ? `,state:Readonly<${stateTypeName}>` : ''})`
      + ':void;'
  ));

  source += '}';


  // Const

  source += `export const ${renameType(handler.name)}:${typeName}={`
      + `name:${JSON.stringify(handler.name)},`
      + mapConcat([handler.commands, handler.events, handler.alerts], (message) => (
          renameVar(message.type) + `(payload){return{type:${compileMessageType(message)},payload};},`
      ));

  if (stateful) {

    // isSupportedEvent
    source += `isSupportedEvent(message):message is ${eventTypeName}{`
        + 'switch(message.type){'
        + mapConcat(handler.events, (message) => `case ${compileMessageType(message)}:`)
        + 'return true;'
        + 'default:return false;'
        + '}},';

    // getAggregateId
    source += 'getAggregateId(message){'
        + 'switch(message.type){'
        + mapConcat(handler.commands, (message) => (
            `case ${compileMessageType(message)}:`
            + `return message.payload${compileAccessor(message.aggregateBy)};`
        ))
        + mapConcat(handler.adoptedEvents, (ref) => (
            `case ${compileMessageType(ref.message)}:`
            + `return message.payload${compileAccessor(ref.aggregateBy)};`
        ))
        + '}},';
  }

  if (handler.commands.size) {

    // isSupportedCommand
    source += `isSupportedCommand(message):message is ${commandTypeName}{`
        + 'switch(message.type){'
        + mapConcat(handler.commands, (message) => `case ${compileMessageType(message)}:`)
        + 'return true;'
        + 'default:return false;'
        + '}},';

    // handleCommand
    source += `handleCommand(handler,command${stateful ? ',state' : ''}){`
        + 'switch(command.type){'
        + mapConcat(handler.commands, (message) => (
            `case ${compileMessageType(message)}:`
            + `return handler.${renameVar(concat('handle', message.type))}(command.payload${stateful ? ',state' : ''});`
        ))
        + '}},';
  }

  if (handler.events.size) {

    // applyEvent
    source += `applyEvent(handler,event${stateful ? ',state' : ''}){`
        + 'switch(event.type){'
        + mapConcat(handler.events, (message) => (
            `case ${compileMessageType(message)}:`
            + `handler.${renameVar(concat('apply', message.type))}(event.payload${stateful ? ',state' : ''});`
            + 'break;'
        ))
        + '}},';
  }

  if (handler.adoptedEvents.size) {

    // isAdoptedEvent
    source += `isAdoptedEvent(message):message is ${adoptedEventTypeName}{`
        + 'switch(message.type){'
        + mapConcat(handler.adoptedEvents, (ref) => `case ${compileMessageType(ref.message)}:`)
        + 'return true;'
        + 'default:return false;'
        + '}},';

    // handleAdoptedEvent
    source += 'handleAdoptedEvent(handler,event){'
        + 'switch(event.type){'
        + mapConcat(handler.adoptedEvents, (ref) => (
            `case ${compileMessageType(ref.message)}:`
            + `return handler.${renameVar(concat('notice', ref.message.handler.name, ref.message.type))}(event.payload);`
        ))
        + '}},';
  }

  source += '};';


  // Message interfaces

  if (handler.adoptedCommands.size) {
    source += `export type ${adoptedCommandTypeName}=`
        + mapConcat(handler.adoptedCommands, (ref) => '|' + renameMessageInterface(ref.message))
        + ';';
  }

  if (handler.adoptedEvents.size) {
    source += `export type ${adoptedEventTypeName}=`
        + mapConcat(handler.adoptedEvents, (ref) => '|' + renameMessageInterface(ref.message))
        + ';';
  }

  source += compileMessageInterfaces(handler.name, handler.commands, allOptions);
  source += compileMessageInterfaces(handler.name, handler.events, allOptions);
  source += compileMessageInterfaces(handler.name, handler.alerts, allOptions);

  return source;
}

function compileMessageInterfaces(handlerName: string, messages: Map<string, IMessageNode>, options: IHandlerTsOptions): string {
  const {
    renameType,
    renameInterface,
    renameEnumValue,
  } = options;

  if (messages.size === 0) {
    return '';
  }

  const messageUnion = parseJtd({
    discriminator: 'type',
    mapping: Array.from(messages.values()).reduce<Record<string, IJtd<ITsJtdMetadata>>>((mapping, message) => Object.assign(mapping, {
      [message.type]: {
        properties: {payload: message.payload},
      },
    }), {}),
  });

  const messageType = Array.from(messages.values())[0].kind;
  const definitions = new Map<string, JtdNode<ITsJtdMetadata>>([[renameType(concat(handlerName, messageType)), messageUnion]]);

  return compileTsFromJtdDefinitions(definitions, {
    renameMappingInterface: (mappingKey) => renameInterface(concat(handlerName, mappingKey)),
    rewriteMappingKey: (mappingKey) => renameType(handlerName) + '.' + renameEnumValue(mappingKey),
  });
}

function mapConcat<T>(src: Many<Map<unknown, T> | Set<T>>, cb: (item: T) => string): string {
  return Arrays.fromMany(src).reduce((str, src) => str + Array.from(src.values()).map(cb).join(''), '');
}

function concat(...strs: Array<string>): string {
  return strs.join(' ');
}

export const handlerTsOptions: IHandlerTsOptions = {
  renameInterface: (name) => 'I' + pascalCase(name),
  renameType: pascalCase,
  renameVar: camelCase,
  renameEnum: pascalCase,
  renameEnumValue: upperSnakeCase,
};
