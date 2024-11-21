import ExtensionSettings from '../configuration/extensionSettings';
import ChatCompletion from '../services/chatCompletion';
import vscode from 'vscode';

export default class PickCopilotModelCommand {
  public static readonly command = 'appmap.copilot.selectModel';

  public static register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        PickCopilotModelCommand.command,
        PickCopilotModelCommand.execute
      )
    );
  }

  public static async execute(): Promise<void> {
    await ChatCompletion.refreshModels();
    if (ChatCompletion.models.length === 0) {
      vscode.window.showErrorMessage('No Copilot models are available.');
      return;
    }

    const model = await vscode.window.showQuickPick(
      ChatCompletion.models.map((m) => ({ label: m.name, details: m.id }))
    );
    if (!model) return;

    await ExtensionSettings.setPreferredCopilotModel(model.details);
    return vscode.commands.executeCommand('appmap.rpc.restart');
  }
}
