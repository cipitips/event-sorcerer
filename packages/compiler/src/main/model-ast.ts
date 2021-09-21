import {IHandlerModel, IMessageModel, IMessageRef} from './model-types';
import {IHandlerNode, IMessageNode, IMessageRefNode, MessageType} from './model-ast-types';
import JsonPointer from 'json-pointer';

/**
 * Converts models to nodes and resolves adopted messages.
 */
export function parseHandlerModels(handlerModels: Array<IHandlerModel>): Map<string, IHandlerNode> {

  const handlerNodes = new Map<string, IHandlerNode>();

  for (const handlerModel of handlerModels) {

    const handlerNode: IHandlerNode = {
      handlerModel,
      handlerType: handlerModel.handlerType,
      name: handlerModel.name,
      definitions: handlerModel.definitions,
      commands: new Map(),
      events: new Map(),
      alerts: new Map(),
      adoptedEvents: new Set(),
      adoptedCommands: new Set(),
    };

    handlerModel.commands?.forEach((messageModel) => {
      handlerNode.commands.set(messageModel.type, parseMessageModel(handlerNode, messageModel, MessageType.COMMAND));
    });

    handlerModel.events?.forEach((messageModel) => {
      handlerNode.events.set(messageModel.type, parseMessageModel(handlerNode, messageModel, MessageType.EVENT));
    });

    handlerModel.alerts?.forEach((messageModel) => {
      handlerNode.alerts.set(messageModel.type, parseMessageModel(handlerNode, messageModel, MessageType.ALERT));
    });

    handlerNodes.set(handlerModel.name, handlerNode);
  }

  for (const handlerNode of handlerNodes.values()) {

    handlerNode.handlerModel.adoptedCommands?.forEach((messageRef) => {
      const messageNode = handlerNodes.get(messageRef.from)?.commands.get(messageRef.type);
      if (!messageNode) {
        throw new Error('Message not found');
      }
      handlerNode.adoptedCommands.add(parseMessageRef(messageRef, messageNode));
    });

    handlerNode.handlerModel.adoptedEvents?.forEach((messageRef) => {
      const messageNode = handlerNodes.get(messageRef.from)?.events.get(messageRef.type);
      if (!messageNode) {
        throw new Error('Message not found');
      }
      handlerNode.adoptedEvents.add(parseMessageRef(messageRef, messageNode));
    });
  }

  return handlerNodes;
}

function parseMessageModel(handlerNode: IHandlerNode, messageModel: IMessageModel, messageType: MessageType): IMessageNode {
  return {
    messageType,
    handler: handlerNode,
    type: messageModel.type,
    description: messageModel.description,
    payload: messageModel.payload,
    aggregateBy: messageModel.aggregateBy ? JsonPointer.parse(messageModel.aggregateBy) : [],
  };
}

function parseMessageRef(messageRef: IMessageRef, messageNode: IMessageNode): IMessageRefNode {
  return {
    message: messageNode,
    aggregateBy: messageRef.aggregateBy ? JsonPointer.parse(messageRef.aggregateBy) : [],
  };
}
