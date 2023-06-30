/* eslint @typescript-eslint/naming-convention: 0 */

import { Extension } from 'vscode';
import EventEmitter from './EventEmitter';

const mocks = new Map<string, unknown>();

export function getExtension<T>(extensionId: string): Partial<Extension<T>> | undefined {
  const ext = mocks.get(extensionId);
  if (!ext) return;

  return {
    isActive: true,
    exports: ext as T,
  };
}

export function mockExtension<T>(id: string, mock: Partial<T>): void {
  mocks.set(id, mock);
}

export function resetExtensionMocks(): void {
  mocks.clear();
}

export const onDidChange = new EventEmitter().event;

export const all = new Array<Extension<unknown>>();
