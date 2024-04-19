import '../mock/vscode';
import Sinon, { SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import { expect } from 'chai';

import { AppMapTreeDataProvider, IAppMapTreeItem } from '../../../src/tree/appMapTreeDataProvider';
import AppMapCollection from '../../../src/services/appmapCollection';
import AppMapLoader from '../../../src/services/appmapLoader';
import { build } from 'tsup';

describe('AppMapTreeDataProvider', () => {
  let sinon: SinonSandbox;
  let provider: AppMapTreeDataProvider;

  beforeEach(() => (sinon = Sinon.createSandbox()));
  afterEach(() => sinon.restore());

  function findProject(label: string) {
    return provider
      .getChildren(undefined)
      .find((treeItem) => treeItem.label === label) as IAppMapTreeItem & vscode.TreeItem;
  }

  function getProjectA() {
    return findProject('project-a');
  }

  function getProjectB() {
    return findProject('project-b');
  }

  function buildSingleProjectWorkspace(appmaps: AppMapLoader[]): () => void {
    return function () {
      sinon.stub(vscode.workspace, 'workspaceFolders').value([
        {
          index: 0,
          name: 'project-a',
          uri: vscode.Uri.file('/path/to/project-a'),
        },
      ]);

      const appmapCollection = {
        appMaps: Sinon.stub().returns(appmaps),
        onUpdated: Sinon.stub(),
      } as unknown as AppMapCollection;
      provider = new AppMapTreeDataProvider(appmapCollection);
    };
  }

  describe('in a single project workspace', () => {
    const appmaps: AppMapLoader[] = [
      {
        descriptor: {
          metadata: {
            name: 'appmap_1',
            language: { name: 'ruby', version: '2.7.2' },
            recorder: {
              type: 'tests',
              name: 'rspec',
            },
          },
          resourceUri: vscode.Uri.file('/path/to/project-a/tmp/appmap/appmap_1.json'),
        },
      } as AppMapLoader,
      {
        descriptor: {
          metadata: {
            name: 'appmap_2',
            language: { name: 'ruby', version: '2.7.2' },
            recorder: {
              type: 'requests',
            },
          },
          resourceUri: vscode.Uri.file('/path/to/project-a/tmp/appmap/appmap_2.json'),
        },
      } as AppMapLoader,
    ];

    beforeEach(buildSingleProjectWorkspace(appmaps));

    describe('getRootElements', () => {
      it('returns the single workspace', async () => {
        const roots = provider.getChildren(undefined);
        expect(roots.map((item) => item.label)).to.deep.equal(['project-a']);
      });
    });

    describe('appmap folders', () => {
      it('exist for each recording type', () => {
        const project = getProjectA();
        const folderItems = provider.getChildren(project);
        expect(folderItems.map((item) => item.label)).to.deep.equal([
          'Requests (ruby)',
          'Tests (ruby + rspec)',
        ]);
      });
    });

    describe('AppMap items', () => {
      function getFolderItem(label: string) {
        return getProjectA().children.find((folder) => folder.label === label);
      }

      it('exist for each AppMap', () => {
        {
          const folderItem = getFolderItem('Tests (ruby + rspec)');
          const appmapItems = provider.getChildren(folderItem);
          expect(appmapItems.map((item) => item.label)).to.deep.equal(['appmap_1']);
        }
        {
          const folderItem = getFolderItem('Requests (ruby)');
          const appmapItems = provider.getChildren(folderItem);
          expect(appmapItems.map((item) => item.label)).to.deep.equal(['appmap_2']);
        }
      });
    });
  });

  describe('requests recordings', () => {
    function requestRecording(name: string, timestamp: number): AppMapLoader {
      return {
        descriptor: {
          metadata: {
            name,
            timestamp,
            language: { name: 'ruby', version: '2.7.2' },
            recorder: {
              type: 'requests',
            },
          },
          timestamp,
          resourceUri: vscode.Uri.file(`/path/to/project-a/tmp/appmap/${name}.json`),
        },
      } as unknown as AppMapLoader;
    }

    const appmaps: AppMapLoader[] = [
      requestRecording('appmap_1', 1),
      requestRecording('appmap_2', 3),
      requestRecording('appmap_3', 5),
      requestRecording('appmap_4', 6),
      requestRecording('appmap_5', 4),
      requestRecording('appmap_6', 2),
    ];

    beforeEach(buildSingleProjectWorkspace(appmaps));

    it('are sorted by timestamp with most recent first', () => {
      const project = getProjectA();
      const folderItems = provider.getChildren(project);
      const appmapItems = provider.getChildren(folderItems[0]);
      expect(appmapItems.map((item) => item.label)).to.deep.equal([
        'appmap_4',
        'appmap_3',
        'appmap_5',
        'appmap_2',
        'appmap_6',
        'appmap_1',
      ]);
    });
  });

  describe('tests recordings', () => {
    function testRecording(name: string, timestamp: number): AppMapLoader {
      return {
        descriptor: {
          metadata: {
            name,
            timestamp,
            language: { name: 'ruby', version: '2.7.2' },
            recorder: {
              type: 'tests',
              name: 'rspec',
            },
          },
          timestamp,
          resourceUri: vscode.Uri.file(`/path/to/project-a/tmp/appmap/${name}.json`),
        },
      } as unknown as AppMapLoader;
    }

    const appmaps: AppMapLoader[] = [
      testRecording('appmap_4', 6),
      testRecording('appmap_1', 1),
      testRecording('appmap_5', 4),
      testRecording('appmap_2', 3),
      testRecording('appmap_3', 5),
      testRecording('appmap_6', 2),
    ];

    beforeEach(buildSingleProjectWorkspace(appmaps));

    it('are sorted alphabetically by label', () => {
      const project = getProjectA();
      const folderItems = provider.getChildren(project);
      const appmapItems = provider.getChildren(folderItems[0]);
      expect(appmapItems.map((item) => item.label)).to.deep.equal([
        'appmap_1',
        'appmap_2',
        'appmap_3',
        'appmap_4',
        'appmap_5',
        'appmap_6',
      ]);
    });
  });

  describe('missing appmap metadata', () => {
    const appmaps: AppMapLoader[] = [
      {
        descriptor: {
          resourceUri: vscode.Uri.file('/path/to/project-a/tmp/appmap/appmap_1.json'),
        },
      } as AppMapLoader,
      {
        descriptor: {
          resourceUri: vscode.Uri.file('/path/to/project-a/tmp/appmap/appmap_2.json'),
        },
      } as AppMapLoader,
    ];

    beforeEach(buildSingleProjectWorkspace(appmaps));

    it('is replaced with suitable defaults', () => {
      const project = getProjectA();
      const folderItems = provider.getChildren(project);
      expect(folderItems.map((item) => item.label)).to.deep.equal(['unspecified language']);
      const appmapItems = provider.getChildren(folderItems[0]);
      expect(appmapItems.map((item) => item.label)).to.deep.equal([
        'Untitled AppMap',
        'Untitled AppMap',
      ]);
    });
  });

  describe('in a multi-project workspace', () => {
    const appmaps: AppMapLoader[] = [
      {
        descriptor: {
          metadata: {
            name: 'appmap_1',
            language: { name: 'ruby', version: '2.7.2' },
            recorder: {
              type: 'tests',
              name: 'rspec',
            },
          },
          resourceUri: vscode.Uri.file('/path/to/project-a/tmp/appmap/appmap_1.json'),
        },
      } as AppMapLoader,
      {
        descriptor: {
          metadata: {
            name: 'appmap_2',
            language: { name: 'ruby', version: '2.7.2' },
            recorder: {
              type: 'requests',
            },
          },
          resourceUri: vscode.Uri.file('/path/to/project-b/tmp/appmap/appmap_2.json'),
        },
      } as AppMapLoader,
    ];

    beforeEach(() => {
      sinon.stub(vscode.workspace, 'workspaceFolders').value([
        {
          index: 0,
          name: 'project-a',
          uri: vscode.Uri.file('/path/to/project-a'),
        },
        {
          index: 1,
          name: 'project-b',
          uri: vscode.Uri.file('/path/to/project-b'),
        },
      ]);

      const appmapCollection = {
        appMaps: Sinon.stub().returns(appmaps),
        onUpdated: Sinon.stub(),
      } as unknown as AppMapCollection;
      provider = new AppMapTreeDataProvider(appmapCollection);
    });

    describe('appmap folders', () => {
      it('are placed in the proper projects', () => {
        {
          const project = getProjectA();
          const folderItems = provider.getChildren(project);
          expect(folderItems.map((item) => item.label)).to.deep.equal(['Tests (ruby + rspec)']);
          const appmapItems = provider.getChildren(folderItems[0]);
          expect(appmapItems.map((item) => item.label)).to.deep.equal(['appmap_1']);
        }
        {
          const project = getProjectB();
          const folderItems = provider.getChildren(project);
          expect(folderItems.map((item) => item.label)).to.deep.equal(['Requests (ruby)']);
          const appmapItems = provider.getChildren(folderItems[0]);
          expect(appmapItems.map((item) => item.label)).to.deep.equal(['appmap_2']);
        }
      });
    });
  });
});
