import * as vscode from 'vscode';

import { OpenAI } from 'openai';

export default async function buildOpenAIApi(
  context: vscode.ExtensionContext
): Promise<OpenAI | undefined> {
  let gptKey = await context.secrets.get('openai.gptKey');
  if (!gptKey) {
    gptKey = await vscode.window.showInputBox({ title: `Enter your OpenAI API key` });
    if (!gptKey) return;

    await context.secrets.store('openai.gptKey', gptKey);
  }

  return new OpenAI({ apiKey: gptKey });
}
