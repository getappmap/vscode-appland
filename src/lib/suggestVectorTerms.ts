import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';

export default async function suggestVectorTerms(openAI: OpenAI, query: string): Promise<string[]> {
  const systemMessages = [
    'A developer has a question about a code base',
    'Suggest vector search terms to match the code base that are relevant to the question',
    'The search terms should be selected to match code packages, classes, methods, and parameters',
    'Respond with a list of search terms, one per line',
  ].map((message) => ({
    content: message,
    role: 'system',
  }));

  const userMessages: ChatCompletionMessageParam[] = [{ content: query, role: 'user' }];

  const messages = [...systemMessages, ...userMessages] as ChatCompletionMessageParam[];

  let response: OpenAI.Chat.Completions.ChatCompletion | undefined;
  try {
    response = await openAI.chat.completions.create({
      model: 'gpt-4',
      messages,
    });
  } catch (err) {
    console.error(err);
    throw new Error('AI term suggestion failed');
  }

  return response.choices
    .map((choice) => choice.message.content)
    .filter(Boolean)
    .join('\n')
    .split(/[\s+/\\:]/);
}
