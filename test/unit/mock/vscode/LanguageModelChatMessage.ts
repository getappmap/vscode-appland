import type { LanguageModelChatMessage, LanguageModelChatMessageRole } from 'vscode';

export default class MockLanguageModelChatMessage implements LanguageModelChatMessage {
  role: LanguageModelChatMessageRole;
  content: string;
  name: string | undefined;

  constructor(role: LanguageModelChatMessageRole, content: string, name?: string) {
    this.role = role;
    this.content = content;
    this.name = name;
  }

  static User = (content: string, name?: string) =>
    new MockLanguageModelChatMessage(1, content, name);

  static Assistant = (content: string, name?: string) =>
    new MockLanguageModelChatMessage(2, content, name);
}
