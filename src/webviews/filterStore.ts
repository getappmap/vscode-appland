import * as vscode from 'vscode';

const SAVED_FILTERS = 'SAVED_FILTERS';

export type SavedFilter = {
  filterName: string;
  state: string;
  default: boolean;
};

export type FilterUpdateEvent = {
  savedFilters: SavedFilter[];
};

export default class FilterStore {
  // TODO: This class should be Disposable and dispose of this event emitter.
  private _onDidChangeFilters = new vscode.EventEmitter<FilterUpdateEvent>();
  readonly onDidChangeFilters = this._onDidChangeFilters.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  getSavedFilters(): SavedFilter[] {
    return (this.context.workspaceState.get(SAVED_FILTERS) as SavedFilter[]) || [];
  }

  async setFilters(filters: SavedFilter[]): Promise<void> {
    await this.context.workspaceState.update(SAVED_FILTERS, filters);

    this._onDidChangeFilters.fire({ savedFilters: filters });
  }

  async saveFilter(filter: SavedFilter): Promise<void> {
    let savedFilters = this.getSavedFilters();

    let filterOverwritten = false;
    savedFilters = savedFilters.map((savedFilter) => {
      if (savedFilter.filterName === filter.filterName) {
        filterOverwritten = true;
        return filter;
      }
      return savedFilter;
    });

    if (!filterOverwritten) savedFilters.push(filter);

    await this.context.workspaceState.update(SAVED_FILTERS, savedFilters);

    this._onDidChangeFilters.fire({ savedFilters });
  }

  async deleteFilter(filter: SavedFilter): Promise<void> {
    const savedFilters = this.getSavedFilters();
    if (savedFilters.length === 0) return;

    const newSavedFilters = savedFilters.filter(
      (savedFilter) => savedFilter.filterName !== filter.filterName
    );

    await this.context.workspaceState.update(SAVED_FILTERS, newSavedFilters);

    this._onDidChangeFilters.fire({ savedFilters });
  }

  async defaultFilter(filter: SavedFilter): Promise<void> {
    const savedFilters = this.getSavedFilters();
    if (savedFilters.length === 0) return;

    savedFilters.forEach(
      (savedFilter) => (savedFilter.default = savedFilter.filterName === filter.filterName)
    );

    await this.context.workspaceState.update(SAVED_FILTERS, savedFilters);

    this._onDidChangeFilters.fire({ savedFilters });
  }
}
