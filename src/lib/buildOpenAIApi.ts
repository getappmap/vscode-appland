import * as vscode from 'vscode';

import { Configuration, OpenAIApi } from 'openai';

export default async function buildOpenAIApi(
  context: vscode.ExtensionContext
): Promise<OpenAIApi | undefined> {
  let gptKey = await context.secrets.get('openai.gptKey');
  if (!gptKey) {
    gptKey = await vscode.window.showInputBox({ title: `Enter your OpenAI API key` });
    if (!gptKey) return;

    await context.secrets.store('openai.gptKey', gptKey);
  }

  return new OpenAIApi(new Configuration({ apiKey: gptKey }));
}
