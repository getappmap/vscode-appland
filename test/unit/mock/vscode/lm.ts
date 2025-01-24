import type { LanguageModelChat, LanguageModelChatSelector } from 'vscode';

import EventEmitter from './EventEmitter';

const models: LanguageModelChat[] = [];

export async function selectChatModels(
  query?: LanguageModelChatSelector
): Promise<LanguageModelChat[]> {
  if (!query) return models;
  return models.filter((model) =>
    Object.entries(query).every(([key, value]) => model[key] === value)
  );
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const didChangeChatModelsEvent = new EventEmitter<void>();
// eslint-disable-next-line @typescript-eslint/naming-convention
export const onDidChangeChatModels = didChangeChatModelsEvent.event;

export function addMockChatModel(model: LanguageModelChat): void {
  models.push(model);
  didChangeChatModelsEvent.fire();
}

export function resetModelMocks() {
  models.length = 0;
  didChangeChatModelsEvent.fire();
}
