import * as vscode from 'vscode';

const OPENAI_API_KEY = 'openai.api_key';

export default function navieConfigurationService(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.openAIApiKey.set', async (key?: string) => {
      const apiKey = key ?? (await vscode.window.showInputBox({ placeHolder: 'OpenAI API Key' }));
      setOpenAIApiKey(context, apiKey);
      if (apiKey) {
        vscode.window.showInformationMessage(
          'AppMap OpenAI API key has been stored in VSCode Secrets.'
        );
      } else {
        vscode.window.showInformationMessage('AppMap OpenAI API Key has been erased.');
      }

      const res = await vscode.window.showInformationMessage(
        'The window must be reloaded for the changes to take effect. Reload now?',
        { modal: true },
        'Reload'
      );
      if (res === 'Reload') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    }),
    vscode.commands.registerCommand('appmap.openAIApiKey.status', async () => {
      const key = await getOpenAIApiKey(context);
      if (key) {
        vscode.window.showInformationMessage(
          'AppMap OpenAI API Key is stored in VSCode Secrets. AppMap Navie will run in "bring your own key" mode.'
        );
      } else {
        vscode.window.showInformationMessage(
          'AppMap OpenAI API Key is NOT set. AppMap Navie will access OpenAI through an AppMap-hosted proxy.'
        );
      }
    })
  );
}

export async function setOpenAIApiKey(
  extensionContext: vscode.ExtensionContext,
  key: string | undefined
): Promise<void> {
  const { secrets } = extensionContext;
  if (key) await secrets.store(OPENAI_API_KEY, key);
  else await secrets.delete(OPENAI_API_KEY);
}

export async function getOpenAIApiKey(
  extensionContext: vscode.ExtensionContext
): Promise<string | undefined> {
  const { secrets } = extensionContext;
  return await secrets.get(OPENAI_API_KEY);
}
