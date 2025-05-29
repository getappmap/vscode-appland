import mockery from 'mockery';
import '../mock/vscode';

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as vscode from 'vscode';

const execStub = sinon.stub();

mockery.registerMock('node:util', { promisify: () => execStub });
mockery.registerMock('node:child_process', { exec: {} });

import QuickReviewCommand from '../../../src/commands/quickReview';
import { RefType, type Repository } from '../../../types/vscode.git';
import MockExtensionContext from '../../mocks/mockExtensionContext';

mockery.deregisterMock('node:util');
mockery.deregisterMock('node:child_process');

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('quickReview', () => {
  let context: vscode.ExtensionContext;
  let showQuickPickStub: sinon.SinonStub;
  let showErrorMessageStub: sinon.SinonStub;
  let showInfoMessageStub: sinon.SinonStub;
  let executeCommandStub: sinon.SinonStub;
  let extensionStub: sinon.SinonStub;
  let mockRepo: Partial<Repository>;

  after(() => {
    mockery.deregisterAll();
    mockery.disable();
  });

  beforeEach(() => {
    context = new MockExtensionContext();
    showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick');
    showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
    showInfoMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
    executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    execStub.resolves({ stdout: '' });
    extensionStub = sinon.stub(vscode.extensions, 'getExtension').returns({
      isActive: true,
      exports: {
        getAPI: () => ({
          repositories: [mockRepo],
        }),
      },
    } as never);

    // Set up a mock repository
    mockRepo = {
      rootUri: vscode.Uri.file('/test/repo'),
      state: {
        HEAD: { commit: 'head-commit', type: RefType.Head },
        workingTreeChanges: [],
        indexChanges: [],
      } as never,
      getBranches: sinon.stub().resolves([
        { name: 'main', commit: 'main-commit' },
        { name: 'develop', commit: 'develop-commit' },
      ]),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('execute', () => {
    it('shows error when git extension is not found', async () => {
      extensionStub.returns(undefined);
      await QuickReviewCommand.execute(context);
      expect(showErrorMessageStub.calledWith('Git extension not found.')).to.be.true;
    });

    it('shows error when no repositories are found', async () => {
      extensionStub.returns({
        isActive: true,
        exports: {
          getAPI: () => ({
            repositories: [],
          }),
        },
      });
      await QuickReviewCommand.execute(context);
      expect(showInfoMessageStub.calledWith('No Git repositories found in the current workspace.'))
        .to.be.true;
    });

    it('shows refs using git for-each-ref command', async () => {
      const refsOutput = [
        'main-hash;main;refs/heads;abc123 ⋅ 2024-01-01',
        'dev-hash;develop;refs/heads;def456 ⋅ 2024-01-02',
      ].join('\n');
      execStub.resolves({ stdout: refsOutput });

      showQuickPickStub.resolves({ label: 'main', commit: 'main-hash' });

      await QuickReviewCommand.execute(context);

      expect(executeCommandStub.calledWith('appmap.explain')).to.be.true;
      expect(executeCommandStub.firstCall.args[1]).to.deep.equal({
        suggestion: {
          label: '@review /base=main',
          prompt: '@review /base=main',
        },
      });
    });

    it('shows HEAD item when there are uncommitted changes', async () => {
      Object.defineProperty(mockRepo.state, 'workingTreeChanges', {
        value: [{ path: 'file1.js' }],
      });
      const refsOutput = [
        'head-commit;HEAD;refs/heads;abc123 ⋅ 2024-01-01',
        'main-hash;main;refs/heads;abc123 ⋅ 2024-01-01',
      ].join('\n');
      execStub.callsFake((command) => {
        if (command.includes('for-each-ref')) {
          return Promise.resolve({ stdout: refsOutput });
        }
        return Promise.resolve({ stdout: '' });
      });

      showQuickPickStub.resolves({ label: 'HEAD' });

      await QuickReviewCommand.execute(context);
      const items = await showQuickPickStub.firstCall.args[0];

      // at least one item should have the label 'HEAD'
      expect(items.find((item: { label: string }) => item.label === 'HEAD')).to.be.ok;
    });

    it('does not show HEAD item when there are no uncommitted changes', async () => {
      const refsOutput = [
        'head-commit;HEAD;refs/heads;abc123 ⋅ 2024-01-01',
        'main-hash;main;refs/heads;abc123 ⋅ 2024-01-01',
      ].join('\n');
      execStub.callsFake((command) => {
        if (command.includes('for-each-ref')) {
          return Promise.resolve({ stdout: refsOutput });
        }
        return Promise.resolve({ stdout: '' });
      });

      showQuickPickStub.resolves({ label: 'HEAD' });

      await QuickReviewCommand.execute(context);
      const items = await showQuickPickStub.firstCall.args[0];

      // at least one item should have the label 'HEAD'
      expect(items.find((item: { label: string }) => item.label === 'HEAD')).to.not.be.ok;
    });

    it('does not show commits if there are no commits between HEAD and the base ref', async () => {
      const refsOutput = [
        'head-commit;HEAD;refs/heads;abc123 ⋅ 2024-01-01',
        'main-hash;main;refs/heads;abc123 ⋅ 2024-01-01',
      ].join('\n');
      execStub.callsFake((command) => {
        if (command.includes('for-each-ref')) {
          return Promise.resolve({ stdout: refsOutput });
        }
        return Promise.resolve({ stdout: '' });
      });

      showQuickPickStub.resolves({ label: 'HEAD' });

      await QuickReviewCommand.execute(context);
      const items = await showQuickPickStub.firstCall.args[0];

      expect(items.find((item: { type: string }) => item.type === 'commit')).to.not.be.ok;
    });

    it('stores last picked reference in workspace state', async () => {
      const refsOutput = ['main-hash;main;refs/heads;abc123 ⋅ 2024-01-01'].join('\n');
      execStub.resolves({ stdout: refsOutput });

      showQuickPickStub.resolves({ label: 'main' });

      await QuickReviewCommand.execute(context);

      expect(context.workspaceState.get('appmap.quickReview.lastPicked')).to.equal('main');
    });

    it('prioritizes last used reference', async () => {
      context.workspaceState.update('appmap.quickReview.lastPicked', 'develop');

      const refsOutput = [
        'main-hash;main;refs/heads;abc123 ⋅ 2024-01-01',
        'dev-hash;develop;refs/heads;def456 ⋅ 2024-01-02',
      ].join('\n');
      execStub.resolves({ stdout: refsOutput });

      showQuickPickStub.resolves({ label: 'develop' });

      await QuickReviewCommand.execute(context);

      await expect(showQuickPickStub.firstCall.args[0]).to.eventually.satisfy(
        (items: { description: string; label: string }[]) => {
          return items[0].label === 'develop' && items[0].description.includes('last used');
        }
      );
    });

    it('falls back to git extension API when git command fails', async () => {
      execStub.rejects(new Error('git command failed'));

      showQuickPickStub.resolves({ label: 'main' });

      await QuickReviewCommand.execute(context);

      expect(mockRepo.getBranches).to.have.been.called;
      expect(executeCommandStub.calledWith('appmap.explain')).to.be.true;
    });

    it('handles user cancellation', async () => {
      showQuickPickStub.resolves(undefined);

      await QuickReviewCommand.execute(context);

      expect(executeCommandStub.called).to.be.false;
      expect(context.workspaceState.get('appmap.quickReview.lastPicked')).to.be.undefined;
    });

    it('includes recent commits in the list', async () => {
      const refsOutput = ['main-hash;main;refs/heads;abc123 ⋅ 2024-01-01'].join('\n');
      const logOutput = ['commit1;abc;2024-01-01 ⋅ First commit'].join('\n');

      execStub.onFirstCall().resolves({ stdout: refsOutput });
      execStub.onSecondCall().resolves({ stdout: logOutput });

      showQuickPickStub.resolves({ label: 'abc' });

      await QuickReviewCommand.execute(context);

      expect(executeCommandStub.calledWith('appmap.explain')).to.be.true;
      expect(executeCommandStub.firstCall.args[1].suggestion.prompt).to.equal('@review /base=abc');
    });
  });

  describe('register', () => {
    it('registers the command with VS Code', () => {
      const registerCommandStub = sinon.stub(vscode.commands, 'registerCommand');

      QuickReviewCommand.register(context);

      expect(registerCommandStub.calledWith('appmap.navie.quickReview')).to.be.true;
      expect(context.subscriptions).to.have.length(1);
    });
  });
});
