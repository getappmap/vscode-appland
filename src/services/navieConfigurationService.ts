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

export async function openAIApiKeyEquals(
  extensionContext: vscode.ExtensionContext,
  key: string | undefined
): Promise<boolean> {
  const { secrets } = extensionContext;
  const storedKey = await secrets.get(OPENAI_API_KEY);
  return key === storedKey;
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

export async function migrateOpenAIApiKey(
  extensionContext: vscode.ExtensionContext
): Promise<void> {
  const value = await getOpenAIApiKey(extensionContext);
  if (value) {
    await setSecretEnvVars(extensionContext, { OPENAI_API_KEY: value });
  }
}

const NAVIE_SECRET_ENV_KEY = 'appmap.navie.env';

export async function getSecretEnv(
  extensionContext: vscode.ExtensionContext
): Promise<Record<string, string>> {
  const { secrets } = extensionContext;
  const envVar = await secrets.get(NAVIE_SECRET_ENV_KEY);
  return envVar ? JSON.parse(envVar) : {};
}

export async function getSecretEnvVar(
  extensionContext: vscode.ExtensionContext,
  envVarName: string
): Promise<string | undefined> {
  const env = await getSecretEnv(extensionContext);
  return env[envVarName];
}

/**
 * Set environment variables within the secret environment context.
 * @param extensionContext The extension context.
 * @param envVars The environment variables to set. If a value is undefined, the variable will be deleted.
 * @returns true if the value was changed, false if no change was made.
 */
export async function setSecretEnvVars(
  extensionContext: vscode.ExtensionContext,
  envVars: Record<string, string | undefined>
): Promise<boolean> {
  const env = await getSecretEnv(extensionContext);
  let changed = false;
  for (const [envVarName, value] of Object.entries(envVars)) {
    if (env[envVarName] !== value) {
      changed = true;
      if (value !== undefined) {
        env[envVarName] = value;
      } else {
        delete env[envVarName];
      }
    }
  }
  await extensionContext.secrets.store(NAVIE_SECRET_ENV_KEY, JSON.stringify(env));
  return changed;
}
