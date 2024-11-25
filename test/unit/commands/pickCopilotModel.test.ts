import vscode from '../mock/vscode';
import sinon from 'sinon';
import { expect } from 'chai';
import PickCopilotModelCommand from '../../../src/commands/pickCopilotModel';
import { addMockChatModel, resetModelMocks } from '../mock/vscode/lm';
import { LanguageModelChat } from 'vscode';

describe('pickCopilotModel', () => {
  describe('execute', () => {
    let models: LanguageModelChat[];
    let executeCommandStub: sinon.SinonStub;
    let showQuickPickStub: sinon.SinonStub;
    let showErrorMessageStub: sinon.SinonStub;
    const chosenModel = 'claude-3.5-sonnet';
    beforeEach(() => {
      models = [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          maxInputTokens: 325,
          family: 'copilot',
        } as LanguageModelChat,
        {
          id: 'claude-3.5-sonnet',
          name: 'Claude 3.5 Sonnet',
          maxInputTokens: 325,
          family: 'copilot',
        } as LanguageModelChat,
      ];
      showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick').callsFake(() => ({
        details: chosenModel,
      }));
      showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage').resolves();
      executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves();
      sinon.stub(vscode.lm, 'selectChatModels').callsFake(() => models as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      models.forEach((m) => addMockChatModel(m));
    });

    afterEach(() => {
      sinon.restore();
      resetModelMocks();
    });

    const setPreferredModel = (model: string | undefined) =>
      vscode.workspace.getConfiguration('appMap').update('copilot.preferredModel', model);
    const getPreferredModel = () =>
      vscode.workspace.getConfiguration('appMap').get('copilot.preferredModel');

    it('sets the appMap.copilot.preferredModel setting', async () => {
      setPreferredModel(undefined);
      await PickCopilotModelCommand.execute();
      expect(getPreferredModel()).to.equal(chosenModel);
    });

    it('shows an error message if no models are available', async () => {
      models = [];
      await PickCopilotModelCommand.execute();
      expect(showErrorMessageStub.called).to.be.true;
      expect(showQuickPickStub.called).to.be.false;
      expect(executeCommandStub.called).to.be.false;
    });

    it('does nothing if the user cancels the quick pick', async () => {
      showQuickPickStub.resolves(undefined);
      setPreferredModel(chosenModel);
      await PickCopilotModelCommand.execute();
      expect(getPreferredModel()).to.equal(chosenModel);
      expect(executeCommandStub.called).to.be.false;
    });
  });
});
