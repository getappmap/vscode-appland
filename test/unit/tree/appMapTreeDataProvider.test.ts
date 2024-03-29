import '../mock/vscode';
import Sinon, { SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import { expect } from 'chai';

import { AppMapTreeDataProvider, IAppMapTreeItem } from '../../../src/tree/appMapTreeDataProvider';
import AppMapCollection from '../../../src/services/appmapCollection';
import { AppmapUptodateService } from '../../../src/services/appmapUptodateService';
import AppMapLoader from '../../../src/services/appmapLoader';

describe('AppMapTreeDataProvider', () => {
  let sinon: SinonSandbox;
  let appmaps: AppMapCollection;
  let provider: AppMapTreeDataProvider;

  const APPMAPS: AppMapLoader[] = [
    {
      descriptor: {
        metadata: {
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
          language: { name: 'ruby', version: '2.7.2' },
          recorder: {
            type: 'requests',
          },
        },
        resourceUri: vscode.Uri.file('/path/to/project-a/tmp/appmap/appmap_2.json'),
      },
    } as AppMapLoader,
  ];

  beforeEach(() => (sinon = Sinon.createSandbox()));
  afterEach(() => sinon.restore());

  beforeEach(() => {
    sinon.stub(vscode.workspace, 'workspaceFolders').value([
      {
        index: 0,
        name: 'project-a',
        uri: vscode.Uri.file('/path/to/project-a'),
      },
    ]);

    appmaps = {
      appMaps: Sinon.stub().returns(APPMAPS),
      onUpdated: Sinon.stub(),
    } as unknown as AppMapCollection;
    provider = new AppMapTreeDataProvider(appmaps);
  });

  describe('getRootElement', () => {
    it('returns the root element', async () => {
      const roots = provider.getChildren(undefined);
      expect(roots.map((item) => item.label)).to.deep.equal(['project-a']);
    });
  });

  describe('Project folder items', () => {
    function getProject() {
      return provider.getChildren(undefined)[0] as IAppMapTreeItem & vscode.TreeItem;
    }

    it('exist for each recording type', () => {
      const project = getProject();
      const folderItems = provider.getChildren(project);
      expect(folderItems.map((item) => item.label)).to.deep.equal([
        'Requests (ruby)',
        'Tests (ruby + rspec)',
      ]);
    });
  });
});
