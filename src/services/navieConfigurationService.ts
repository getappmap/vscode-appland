import * as vscode from 'vscode';

const OPENAI_API_KEY = 'openai.api_key';

export default function navieConfigurationService(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.openAIApiKey.set', async () => {
      vscode.window.showInputBox({ placeHolder: 'OpenAI API Key' }).then((key) => {
        setOpenAIApiKey(context, key);
        if (key) {
          vscode.window.showInformationMessage(
            `AppMap OpenAI API key has been stored in VSCode Secrets. Run the command 'Developer: Reload Window' to start using AppMap Navie in "bring your own key" mode.`
          );
        } else {
          vscode.window.showInformationMessage(
            `Appmap OpenAI API Key has been erased. Run the command 'Developer: Reload Window' to stop using AppMap Navie in "bring your own key" mode.`
          );
        }
      });
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
