import * as vscode from 'vscode';
import assert from 'assert';
import { ChatCompletionRequestMessage, CreateChatCompletionResponse, OpenAIApi } from 'openai';

const MAX_TITLE = 30;

export async function suggestFix(
  openAI: OpenAIApi,
  title: string,
  systemMessages: ChatCompletionRequestMessage[],
  userMessages: ChatCompletionRequestMessage[]
) {
  const messages = [...systemMessages, ...userMessages];

  let response: CreateChatCompletionResponse;
  try {
    const result = await openAI.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages,
      n: 1,
      max_tokens:
        // 4096 is the maximum number of tokens allowed by gpt-3.5-turbo
        4096 -
        // This is a conservative estimate of the number of tokens in the prompt, since
        // a token can be more than one character.
        (messages.map((msg) => msg.content?.length).filter(Boolean) as number[]).reduce(
          (a, b) => a + b,
          0
        ),
    });
    response = result.data;
  } catch (e) {
    vscode.window.showErrorMessage((e as any).toString());
    return;
  }

  const promptContent = [
    '```',
    ...messages.map((msg) => [msg.role, msg.content].join(': ')),
    '```',
  ].join('\n');
  const responseContent = response.choices
    .filter((choice) => choice.message)
    .map((choice) => (assert(choice.message), choice.message.content))
    .filter(Boolean)
    .join('\n');

  title = title.replaceAll('\n', ' ');
  if (title.length > MAX_TITLE) title = title.slice(0, MAX_TITLE) + '...';

  const newDocument = await vscode.workspace.openTextDocument({
    content: [`## Analysis of '${title}'`, responseContent, `## Prompt`, promptContent].join(
      '\n\n'
    ),
  });
  vscode.window.showTextDocument(newDocument);
}
