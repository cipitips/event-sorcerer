

// function getReferencedMessageModel(agentModels: Array<IAgentModel>, ref: IMessageRefModel, messageKind: MessageKind): [IAgentModel, IMessageModel] {
//   for (const agentModel of agentModels) {
//     if (agentModel.name !== ref.from) {
//       continue;
//     }
//     const messageModels = agentModel[pluralMessageKinds[messageKind]] || die(`Agent "${agentModel.name}" doesn't declare ${pluralMessageKinds[messageKind]}`);
//     const messageModel = getMessageByType(ref.type, messageModels) || die(`Message "${ref.type}" wasn't found among ${pluralMessageKinds[messageKind]} of "${agentModel.name}" agent`);
//
//     return [agentModel, messageModel];
//   }
//   die(`Agent "${ref.from}" wasn't found`);
// }
//
// const pluralMessageKinds = {
//   [MessageKind.COMMAND]: 'commands',
//   [MessageKind.EVENT]: 'events',
//   [MessageKind.ALERT]: 'alerts',
// } as const;
