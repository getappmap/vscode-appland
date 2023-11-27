import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';

const TOKEN_LIMIT = 8000;

export async function explain(
  openAI: OpenAI,
  query: string,
  sequenceDiagrams: string[],
  codeSnippets: Map<string, string>
): Promise<string> {
  const systemMessages = [
    'You are a code explainer.',
    'Respond in about 200 words, using Markdown.',
    'Include code snippets and code file paths.',
    `If the user has asked a question, answer the question.`,
    'If the user has provided keywords or a code snippet, but is not asking a question, summarize what the code does.',
  ].map((message) => ({
    content: message,
    role: 'system',
  }));

  const userMessages: ChatCompletionMessageParam[] = [
    { content: `User question: ${query}`, role: 'user' },
  ];

  const tokensRemaining = TOKEN_LIMIT - 250 /* question */ - 1000; /* response */
  let charsRemaining = tokensRemaining * 3;

  const addContext = (context: string) => {
    if (charsRemaining - context.length < 0) return false;

    charsRemaining -= context.length;
    userMessages.push({
      content: context,
      role: 'user',
    });
    return true;
  };

  const diagramsText = sequenceDiagrams.map((diagram) => `Sequence diagram: ${diagram}`);
  const codeSnippetsText = Array.from(codeSnippets.entries()).map(
    (snippet) => `${snippet[0]}: ${snippet[1]}`
  );

  const contextItems = new Array<string | undefined>();

  const addDiagramAndText = () => {
    contextItems.push(diagramsText.shift());
    contextItems.push(codeSnippetsText.shift());
    contextItems.push(codeSnippetsText.shift());
    contextItems.push(codeSnippetsText.shift());
    contextItems.push(codeSnippetsText.shift());
    contextItems.push(codeSnippetsText.shift());
  };

  while (diagramsText.length > 0 || codeSnippetsText.length > 0) {
    addDiagramAndText();
  }

  for (const context of contextItems) {
    if (context) if (!addContext(context)) break;
  }

  const messages = [...systemMessages, ...userMessages] as ChatCompletionMessageParam[];

  let response: OpenAI.Chat.Completions.ChatCompletion | undefined;
  try {
    response = await openAI.chat.completions.create({
      model: 'gpt-4',
      messages,
    });
  } catch (err) {
    console.error(err);
    throw new Error('AI explanation failed');
  }

  return response.choices.map((choice) => choice.message.content).join('\n');
}
