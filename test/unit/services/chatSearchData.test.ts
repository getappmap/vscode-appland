import { expect } from 'chai';
import Sinon from 'sinon';

import '../mock/vscode';
import * as vscode from 'vscode';

import AppMapCollection from '../../../src/services/appmapCollection';
import RpcProcessService from '../../../src/services/rpcProcessService';
import ChatSearchDataService, { LatestAppMap } from '../../../src/services/chatSearchDataService';

type AppMapListener = (appmaps: LatestAppMap[]) => void;

describe('ChatSearchData', () => {
  let sinon: Sinon.SinonSandbox;
  let chatSearchData: ChatSearchDataService;
  let port: Sinon.SinonStub;
  let onUpdatedStub: Sinon.SinonStub;
  let allAppMapsStub: Sinon.SinonStub;
  let appmapListeners: Array<AppMapListener>;
  let appmaps: AppMapCollection;

  beforeEach(async () => {
    sinon = Sinon.createSandbox();
    port = sinon.stub();
    appmapListeners = [];
    onUpdatedStub = sinon.stub().callsFake((listener: AppMapListener) => {
      appmapListeners.push(listener);
    });
    allAppMapsStub = sinon.stub();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    appmaps = {
      allAppMaps: allAppMapsStub,
      onUpdated: onUpdatedStub,
    } as any;
    const rpcService: RpcProcessService = { port } as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    chatSearchData = new ChatSearchDataService(rpcService, appmaps);
  });

  describe('when no port is available', () => {
    it('appmapRpcPort is undefined', () => {
      expect(chatSearchData.appmapRpcPort).to.be.undefined;
    });
  });

  describe('when a port is available', () => {
    beforeEach(() => port.returns(1234));

    it('appmapRpcPort returns the port', () => {
      expect(chatSearchData.appmapRpcPort).to.equal(1234);
    });
  });

  describe('when an active text editor is available', () => {
    // Mock activeTextEditor to simulate a user code selection
    const mockTextSelection = new vscode.Selection(
      new vscode.Position(5, 0), // Start line 5
      new vscode.Position(7, 10) // End line 7, character 10
    );
    const mockTextDocument: Partial<vscode.TextDocument> = {
      fileName: '/path/to/file.js',
      getText: () => 'const selectedCode = true;',
      languageId: 'javascript',
    };

    describe('but no code selection is made', () => {
      it('codeSelection returns undefined', async () => {
        const mockTextEditor: Partial<vscode.TextEditor> = {
          document: mockTextDocument as vscode.TextDocument,
        };

        sinon
          .stub(vscode.window, 'activeTextEditor')
          .get(() => mockTextEditor as vscode.TextEditor);

        const selection = await chatSearchData.codeSelection();
        expect(selection).to.be.undefined;
      });
    });

    describe('and a code selection is made', () => {
      it('codeSelection returns details about the selection', async () => {
        const mockTextEditor: Partial<vscode.TextEditor> = {
          selection: mockTextSelection,
          document: mockTextDocument as vscode.TextDocument,
        };

        sinon
          .stub(vscode.window, 'activeTextEditor')
          .get(() => mockTextEditor as vscode.TextEditor);

        const selection = await chatSearchData.codeSelection();
        const code = mockTextDocument.getText
          ? mockTextDocument.getText(mockTextSelection)
          : undefined;

        expect(selection).to.deep.equal({
          path: mockTextDocument.fileName,
          lineStart: mockTextSelection.start.line,
          lineEnd: mockTextSelection.end.line,
          code,
          language: mockTextDocument.languageId,
        });
      });
    });
  });

  describe('latestAppMaps', () => {
    // Mock appmaps with timestamps
    const mockAppMaps = [...Array(20).keys()].map((i) => ({
      descriptor: {
        timestamp: Date.now() - i * 1000, // Assure descending order by timestamp
        metadata: { name: `AppMap ${i}` },
        resourceUri: { fsPath: `path/to/appmap${i}.json` },
      },
    }));

    beforeEach(() => allAppMapsStub.returns(mockAppMaps));

    it('provides the latest 10 appmaps based on timestamp', async () => {
      const latestAppMaps = chatSearchData.latestAppMaps();

      expect(latestAppMaps).to.have.lengthOf(10);
      expect(latestAppMaps[0].name).to.equal('AppMap 0'); // Most recent
      expect(latestAppMaps[9].name).to.equal('AppMap 9'); // 10th recent
    });

    describe('onAppMapsUpdated event', () => {
      it('should fire when appmaps are updated, providing the latest appmaps', (done) => {
        chatSearchData.onAppMapsUpdated((latestAppMaps) => {
          try {
            expect(latestAppMaps).to.be.an('array').that.is.not.empty;
            done();
          } catch (error) {
            done(error);
          }
        });

        // Trigger the update
        expect(appmapListeners).to.have.lengthOf(1);
        for (const listener of appmapListeners) {
          listener([sinon.stub() as unknown as LatestAppMap]);
        }
      });
    });
  });
});
