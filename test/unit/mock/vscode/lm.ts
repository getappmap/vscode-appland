import type { LanguageModelChat, LanguageModelChatSelector } from 'vscode';

const models: LanguageModelChat[] = [];

export async function selectChatModels(
  query?: LanguageModelChatSelector
): Promise<LanguageModelChat[]> {
  if (!query) return models;
  return models.filter((model) =>
    Object.entries(query).every(([key, value]) => model[key] === value)
  );
}

export function addMockChatModel(model: LanguageModelChat): void {
  models.push(model);
}

export function resetModelMocks() {
  models.length = 0;
}
