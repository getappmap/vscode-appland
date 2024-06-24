import '../mock/vscode';

import { QuickSearchProvider } from '../../../src/commands/quickSearch';
import Position from '../mock/vscode/Position';
import Range from '../mock/vscode/Range';
import TextDocument from '../mock/vscode/TextDocument';
import { expect } from 'chai';
import CodeAction from '../mock/vscode/CodeAction';
import { TEST_WORKSPACE } from '../mock/vscode/workspace';

describe('Quick search', () => {
  describe('QuickSearchProvider', () => {
    let quickSearchProvider: QuickSearchProvider;

    beforeEach(() => (quickSearchProvider = new QuickSearchProvider()));

    it('returns a CodeAction', () => {
      const range = new Range(new Position(0, 0), new Position(2, 3));
      const document = new TextDocument(
        'foo.rb',
        ['def foo', '  puts "hello world"', 'end'].join('\n'),
        'ruby'
      );

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const actions: CodeAction[] = quickSearchProvider.provideCodeActions(
        document as any,
        range as any
      ) as any;
      /* eslint-enable @typescript-eslint/no-explicit-any */

      expect(actions).to.be.an('array');
      expect(actions).to.have.lengthOf(1);
      const action = actions[0];
      expect(action.title).to.equal('Explain with AppMap Navie AI');
      expect(JSON.stringify(action.command, null, 2)).to.equal(
        JSON.stringify(
          {
            command: 'appmap.quickExplain',
            title: 'Explain with AppMap Navie AI',
            arguments: [
              TEST_WORKSPACE.uri,
              {
                path: 'foo.rb',
                lineStart: range.start.line,
                lineEnd: range.end.line,
                code: 'def foo\n  puts "hello world"\nend',
                language: 'ruby',
              },
            ],
          },
          null,
          2
        )
      );
    });
  });
});
