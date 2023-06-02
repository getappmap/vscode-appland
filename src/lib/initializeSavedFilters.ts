import * as vscode from 'vscode';
import { AppMapFilter, base64UrlEncode, serializeFilter } from '@appland/models';
import AppMapEditorProvider, { SavedFilter } from '../editor/appmapEditorProvider';

export default function initializeDefaultFilter(context: vscode.ExtensionContext) {
  const savedFilters = context.workspaceState.get(AppMapEditorProvider.SAVED_FILTERS) as
    | SavedFilter[]
    | undefined;

  if (savedFilters && Array.isArray(savedFilters) && savedFilters.length > 0) return;

  const defaultFilter = new AppMapFilter();
  const serialized = serializeFilter(defaultFilter);
  const base64Encoded = base64UrlEncode(JSON.stringify({ filters: serialized }));

  const filterObject = {
    filterName: 'AppMap default',
    state: base64Encoded,
    default: true,
  } as SavedFilter;

  context.workspaceState.update(AppMapEditorProvider.SAVED_FILTERS, [filterObject]);
}
