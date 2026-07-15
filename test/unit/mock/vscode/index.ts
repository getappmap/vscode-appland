import mockery from 'mockery';

import CancellationTokenSource from './CancellationTokenSource';
import LanguageModelChatMessage from './LanguageModelChatMessage';
import TextDocument from './TextDocument';
import Range from './Range';
import Position from './Position';
import Location from './Location';
import Selection from './Selection';
import EventEmitter from './EventEmitter';
import Terminal from './Terminal';
import CodeAction from './CodeAction';
import CodeActionKind from './CodeActionKind';
import * as extensions from './extensions';
import * as lm from './lm';
import { URI, Utils } from 'vscode-uri';
import workspace from './workspace';
import { default as window, ViewColumn } from './window';
import commands from './commands';
import * as env from './env';
import * as authentication from './authentication';

enum UIKind {
  Desktop = 'Desktop',
  Web = 'Web',
}

enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

enum QuickPickItemKind {
  Default = 0,
  Separator = 1,
}

const MockVSCode = {
  ProgressLocation,
  ConfigurationTarget,
  authentication,
  CancellationTokenSource,
  EventEmitter,
  LanguageModelChatMessage,
  Terminal,
  TextDocument,
  Range,
  Position,
  Location,
  ThemeIcon: class {
    constructor(public id: string) {}
  },
  QuickPickItemKind,
  ViewColumn,
  Selection,
  CodeAction,
  CodeActionKind,
  extensions,
  lm,
  Uri: { ...URI, ...Utils },
  workspace,
  window,
  commands,
  StatusBarAlignment,
  env,
  // Minimal stand-in for vscode.TreeItem: enough for TreeDataProvider unit tests to
  // read back the label/collapsible state and the fields providers commonly set.
  TreeItem: class {
    label?: string;
    collapsibleState?: number;
    resourceUri?: unknown;
    iconPath?: unknown;
    command?: unknown;
    id?: string;
    tooltip?: string;
    contextValue?: string;
    constructor(labelOrUri?: unknown, collapsibleState?: number) {
      if (labelOrUri && typeof labelOrUri === 'object' && 'path' in labelOrUri) {
        this.resourceUri = labelOrUri;
      } else {
        this.label = labelOrUri as string | undefined;
      }
      this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  TerminalLink: class {
    constructor(public startIndex: number, public length: number, public tooltip?: string) {}
  },
  RelativePattern: class {
    base: string;
    baseUri: URI;
    constructor(base: string | URI | { uri: URI }, public pattern: string) {
      if (typeof base === 'string') this.baseUri = URI.file(base);
      else if ('uri' in base) this.baseUri = base.uri;
      else this.baseUri = base;
      this.base = this.baseUri.fsPath;
    }
  },
  UIKind,
};

class mockTelemetry {
  sendTelemetryEvent(): void {
    /* no-op */
  }
  sendTelemetryErrorEvent(): void {
    /* no-op */
  }
  dispose(): Promise<void> {
    return Promise.resolve();
  }
}

mockery.registerMock('vscode', MockVSCode);
mockery.registerMock('vscode-extension-telemetry', mockTelemetry);
mockery.enable({ warnOnUnregistered: false });

export default MockVSCode;
