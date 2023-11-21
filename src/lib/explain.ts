import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';

export async function explain(
  openAI: OpenAI,
  plantUML: string,
  codeSnippets: Map<string, string>
): Promise<string | undefined> {
  const systemMessages = [
    'You are a code explainer.',
    'You are provided with a sequence diagram in PlantUML format, and code snippets that are relevant to the diagram.',
    'Summarize what the code does in about 200 words, using Markdown.',
  ].map((message) => ({
    content: message,
    role: 'system',
  }));

  const userMessages = [
    `Sequence diagram: ${plantUML}`,
    ...Array.from(codeSnippets.entries()).map((snippet) => `${snippet[0]}: ${snippet[1]}`),
  ].map((message) => ({ content: message, role: 'user' }));

  const messages = [...systemMessages, ...userMessages] as ChatCompletionMessageParam[];

  let response: OpenAI.Chat.Completions.ChatCompletion | undefined;
  try {
    response = await openAI.chat.completions.create({
      model: 'gpt-4',
      messages,
    });
  } catch (err) {
    console.error(err);
    return;
  }

  return response.choices.map((choice) => choice.message.content).join('\n');
}
