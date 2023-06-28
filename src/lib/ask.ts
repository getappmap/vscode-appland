import * as vscode from 'vscode';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  CreateChatCompletionResponse,
  OpenAIApi,
} from 'openai';
import assert from 'assert';
import { CodeObject } from '@appland/models';

export default async function ask(
  question: string,
  codeToDescribe: string,
  codeObject: CodeObject,
  returnValues: string[],
  scopeCodeObjects: CodeObject[],
  functions: string[],
  sequenceDiagram: string,
  openAI: OpenAIApi
): Promise<string | undefined> {
  const systemMessages: ChatCompletionRequestMessage[] = [
    {
      content: `You are a software developer explaining how code works.`,
      role: 'system',
    },
    {
      content: `Be as assertive as possible. Make your best guess based on the information you have available.`,
      role: 'system',
    },
    {
      content: `Try to include URL routes, SQL queries, function names, and code snippets.`,
      role: 'system',
    },
    {
      content: `Use a list format for the answer.`,
      role: 'system',
    },
    {
      content: `Do not discuss software development in general terms.`,
      role: 'system',
    },
    {
      content: `Do not make statements like "However, without seeing the complete codebase...".`,
      role: 'system',
    },
  ];

  const userMessages: ChatCompletionRequestMessage[] = [
    `A code snippet is: ${codeToDescribe}`,
    `The code snippet part of a function called: ${codeObject.fqid}`,
    `The code snippet returns ${returnValues.join(' or ')}`,
    `It's used to implement higher-level functions such as ${scopeCodeObjects
      .map((co) => co.fqid)
      .join(', ')}`,
    ...functions.map((fn) => `Related code includes: ${fn}`),
    `A PlantUML sequence diagram about this code flow is: ${sequenceDiagram}`,
    `Answer the following question about the code snippet: "${question}"`,
  ].map((message) => ({
    content: message,
    role: 'user' as ChatCompletionRequestMessageRoleEnum,
  }));

  const messages = [...systemMessages, ...userMessages];

  let response: CreateChatCompletionResponse;
  try {
    const result = await openAI.createChatCompletion({
      model: 'gpt-3.5-turbo-16k',
      messages,
      n: 1,
      max_tokens:
        // 16384 is the maximum number of tokens allowed by gpt-3.5-turbo-16k
        16384 -
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

  const newDocument = await vscode.workspace.openTextDocument({
    content: [
      `## ${codeToDescribe}`,
      responseContent,
      `## Prompt
  <details>
  <summary>Click to expand</summary>

  ${promptContent}

  </details>
        `,
    ].join('\n\n'),
  });
  await vscode.window.showTextDocument(newDocument);

  return responseContent;
}
