import { CodeObject } from '@appland/models';
import assert from 'assert';
import { warn } from 'console';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  OpenAIApi,
} from 'openai';

export type Completion = {
  prompt: string;
  response: string;
};

abstract class Ask {
  public model = 'gpt-3.5-turbo-16k';

  public language?: string;
  public codeObject?: CodeObject;
  public scopeCodeObjects?: CodeObject[];
  public returnValues?: string[];
  public sequenceDiagram?: string;

  public constructor(public readonly selectedCode: string, public readonly question: string) {}

  async complete(ai: OpenAIApi): Promise<Completion | undefined> {
    const propertyBasedUserMessages: string[] = [`A code snippet is: ${this.selectedCode}`];
    if (this.codeObject)
      propertyBasedUserMessages.push(
        `The code snippet belongs to a function called: ${this.codeObject.fqid}`
      );
    if (this.returnValues && this.returnValues.length > 0)
      propertyBasedUserMessages.push(`The code snippet returns ${this.returnValues.join(' or ')}`);
    if (this.scopeCodeObjects && this.scopeCodeObjects.length > 0)
      propertyBasedUserMessages.push(
        `The code snippet is used by higher-level functions such as ${this.scopeCodeObjects
          .map((co) => co.fqid)
          .join(', ')}`
      );
    if (this.sequenceDiagram)
      propertyBasedUserMessages.push(
        `A PlantUML sequence diagram about this code flow is: ${this.sequenceDiagram}`
      );

    const systemMessages: ChatCompletionRequestMessage[] = this.systemMessages.map((message) => ({
      content: message,
      role: 'system' as ChatCompletionRequestMessageRoleEnum,
    }));

    const userMessages: ChatCompletionRequestMessage[] = [
      ...propertyBasedUserMessages,
      ...this.userMessages,
    ].map((message) => ({
      content: message,
      role: 'user' as ChatCompletionRequestMessageRoleEnum,
    }));

    const messages = [...systemMessages, ...userMessages];
    try {
      const result = await ai.createChatCompletion({
        model: this.model,
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
      const response = result.data.choices
        .map((choice) => (assert(choice.message), choice.message.content))
        .filter(Boolean)
        .join('\n');
      return {
        prompt: messages.map((msg) => [msg.role, msg.content].join(': ')).join('\n'),
        response,
      };
    } catch (e) {
      warn((e as any).toString());
      return;
    }
  }

  protected abstract get systemMessages(): string[];

  protected abstract get userMessages(): string[];
}

export class Question extends Ask {
  public constructor(public readonly selectedCode: string, public readonly question: string) {
    super(selectedCode, question);
  }

  protected get userMessages(): string[] {
    return [`Answer the following question about the code: "${this.question}"`];
  }

  protected get systemMessages(): string[] {
    return [
      `You are a software developer explaining how code works.`,
      `Be as assertive as possible. Make your best guess based on the information you have available.`,
      `Try to include URL routes, SQL queries, function names, and code snippets.`,
      `Use a list format for the answer.`,
      `Do not discuss software development in general terms.`,
      `Do not make statements like "However, without seeing the complete codebase...".`,
    ];
  }
}

export class CodeGen extends Ask {
  public constructor(public readonly selectedCode: string, public readonly question: string) {
    super(selectedCode, question);
  }

  protected get userMessages(): string[] {
    return [`Generate code to: "${this.question}"`];
  }

  protected get systemMessages(): string[] {
    const messages = [
      `You are a software developer writing code.`,
      `Be as assertive as possible. Make your best guess based on the information you have available.`,
      `Respond with code that is syntactically correct.`,
    ];
    if (this.language) messages.push(`Respond with code in ${this.language}.`);

    return messages;
  }
}
