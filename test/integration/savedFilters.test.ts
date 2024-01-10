import assert from 'assert';
import sinon from 'sinon';
import * as vscode from 'vscode';
import MockExtensionContext from '../mocks/mockExtensionContext';
import ExtensionState from '../../src/configuration/extensionState';
import FilterStore, { SavedFilter } from '../../src/webviews/filterStore';

const defaultFilter = {
  default: true,
  filterName: 'AppMap default',
  state: 'eyJmaWx0ZXJzIjp7fX0',
};

const testFilter = {
  default: false,
  filterName: 'test',
  state: 'eyJmaWx0ZXJzIjp7ImxpbWl0Um9vdEV2ZW50cyI6ZmFsc2UsImhpZGVVbmxhYmVsZWQiOnRydWV9fQ',
};

describe('Saved filters', () => {
  let sandbox: sinon.SinonSandbox;
  let context: vscode.ExtensionContext;
  let filterStore: FilterStore;
  let savedFilterUpdates: SavedFilter[][];

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    context = new MockExtensionContext();
    filterStore = new FilterStore(context);
    filterStore.setFilters([defaultFilter]);
    savedFilterUpdates = new Array<SavedFilter[]>();
    filterStore.onDidChangeFilters(({ savedFilters }) => {
      savedFilterUpdates.push(savedFilters);
    });
  });
  afterEach(() => sandbox.restore());

  it('saves and deletes a new filter', async () => {
    await filterStore.saveFilter(testFilter);
    let savedFilters = filterStore.getSavedFilters();
    assert.deepEqual(savedFilters, [defaultFilter, testFilter]);
    assert.deepEqual(savedFilterUpdates.length, 1);

    await filterStore.deleteFilter(testFilter);
    savedFilters = filterStore.getSavedFilters();
    assert.deepEqual(savedFilters, [defaultFilter]);
    assert.deepEqual(savedFilterUpdates.length, 2);
  });

  it('updates an already extant saved filter', async () => {
    await filterStore.saveFilter(testFilter);
    let savedFilters = filterStore.getSavedFilters();
    assert.deepEqual(savedFilters, [defaultFilter, testFilter]);

    const updatedFilter = {
      filterName: 'test',
      state: 'eyJmaWx0ZXJzIjp7ImxpbWl0Um9vdEV2ZW50cyI6ZmFsc2UsImhpZGVVbmxhYmVsZWQiOnRydWV9fQ',
      default: false,
    };

    await filterStore.saveFilter(updatedFilter);
    savedFilters = filterStore.getSavedFilters();

    assert.deepEqual(savedFilters, [defaultFilter, updatedFilter]);
    assert.deepEqual(savedFilterUpdates.length, 2);
  });

  it('saves a new filter and makes it default', async () => {
    await filterStore.saveFilter(testFilter);
    let savedFilters = filterStore.getSavedFilters();
    assert.deepEqual(savedFilters, [defaultFilter, testFilter]);
    assert.deepEqual(savedFilterUpdates.length, 1);

    await filterStore.defaultFilter(testFilter);
    savedFilters = filterStore.getSavedFilters();

    const expected = [
      {
        default: false,
        filterName: defaultFilter.filterName,
        state: defaultFilter.state,
      },
      {
        default: true,
        filterName: testFilter.filterName,
        state: testFilter.state,
      },
    ];

    assert.deepEqual(savedFilters, expected);
    assert.deepEqual(savedFilterUpdates.length, 2);
  });
});
