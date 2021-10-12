import {AgentType} from '@event-sorcerer/runtime';
import * as prettier from 'prettier';
import {compileAgentModel} from '../main/compileAgentModel';

describe('compileAgentModel', () => {

  test('', () => {
    console.log(prettier.format(compileAgentModel({
      name: 'User',
      type: AgentType.AGGREGATE,
      state: {
        type: 'string',
      },
      // state: {
      //   definitions: {
      //     uuid: {
      //       type: 'string'
      //     }
      //   },
      //   properties: {
      //     id: {ref: 'uuid'},
      //     firstName: {type: 'string'},
      //     age: {type: 'int8'},
      //   },
      // },
      commands: [
        {
          type: 'CREATE',
          aggregateBy: '/id',
          payload: {
            properties: {
              firstName: {type: 'string'},
              age: {type: 'int8'},
            },
          },
        },
        {
          type: 'DEL',
          aggregateBy: '/id',
          payload: {
            properties: {
              id: {type: 'string'},
            },
          },
        },
      ],
      events: [
        {
          type: 'CREATED',
          aggregateBy: '/id',
          payload: {
            properties: {
              id: {type: 'string'},
              firstName: {type: 'string'},
              age: {type: 'int8'},
            },
          },
        },
        {
          type: 'DELETED',
          aggregateBy: '/id',
          payload: {
            properties: {
              id: {type: 'string'},
            },
          },
        },
      ],
    }, () => {throw 123}, () => {throw 123}, {
      // renameMessageTypeEnum: (agentModel, messageKind) => '___' + messageKind + 'Type',
      // renameMessageTypeAlias: (agentModel, messageKind) => '___' + messageKind,
      // renameAgentStateType: (agentModel) => 'Okay',
    }), {
      arrowParens: 'always',
      bracketSpacing: false,
      parser: 'typescript',
      printWidth: 150,
      singleQuote: true,
      trailingComma: 'all',
    }));
  });
});
