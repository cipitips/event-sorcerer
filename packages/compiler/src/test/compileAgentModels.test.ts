import {AgentType} from '@event-sorcerer/runtime';
import {compileAgentModels} from '../main/compileAgentModels';
import * as prettier from 'prettier';

describe('compileAgentModels', () => {

  test('', () => {
    console.log(prettier.format(compileAgentModels({
      './user.ts': {
        name: 'User',
        type: AgentType.AGGREGATE,
        state: {
          type: 'string'
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
            type: 'DELETE',
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
      },
    },{
      // renameMessageTypeEnum: (agentModel, messageKind) => '___' + messageKind + 'Type',
      // renameMessageUnionTypeAlias: (agentModel, messageKind) => '___' + messageKind,
      // renameAgentStateType: (agentModel) => 'Okay',
    })['./user.ts'], {
      arrowParens: 'always',
      bracketSpacing: false,
      parser: 'typescript',
      printWidth: 150,
      singleQuote: true,
      trailingComma: 'all',
    }));
  });
});
