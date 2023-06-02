import assert from 'assert';
import sinon from 'sinon';
import * as vscode from 'vscode';
import MockExtensionContext from '../mocks/mockExtensionContext';
import initializeDefaultFilter from '../../src/lib/initializeSavedFilters';
import AppMapEditorProvider from '../../src/editor/appmapEditorProvider';
import ExtensionState from '../../src/configuration/extensionState';

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
  let extensionState: ExtensionState;
  let editorProvider: AppMapEditorProvider;
  let updateFiltersSpy: sinon.SinonSpy;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    context = new MockExtensionContext();
    extensionState = new ExtensionState(context);
    editorProvider = new AppMapEditorProvider(context, extensionState);
    updateFiltersSpy = sinon.spy(editorProvider, 'updateFilters');
    await initializeDefaultFilter(context);
  });
  afterEach(() => sandbox.restore());

  it('initializes filters to AppMap default', () => {
    assert.deepEqual(context.workspaceState.get(AppMapEditorProvider.SAVED_FILTERS), [
      defaultFilter,
    ]);
  });

  it('saves and deletes a new filter', async () => {
    await editorProvider.saveFilter(testFilter);
    let savedFilters = editorProvider.getSavedFilters();
    assert.deepEqual(savedFilters, [defaultFilter, testFilter]);
    assert.deepEqual(updateFiltersSpy.callCount, 1);

    await editorProvider.deleteFilter(testFilter);
    savedFilters = editorProvider.getSavedFilters();
    assert.deepEqual(savedFilters, [defaultFilter]);
    assert.deepEqual(updateFiltersSpy.callCount, 2);
  });

  it('saves a new filter and makes it default', async () => {
    await editorProvider.saveFilter(testFilter);
    let savedFilters = editorProvider.getSavedFilters();
    assert.deepEqual(savedFilters, [defaultFilter, testFilter]);
    assert.deepEqual(updateFiltersSpy.callCount, 1);

    await editorProvider.defaultFilter(testFilter);
    savedFilters = editorProvider.getSavedFilters();

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
    assert.deepEqual(updateFiltersSpy.callCount, 2);
  });
});
