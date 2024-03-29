import mockery from 'mockery';

import TextDocument from './TextDocument';
import Range from './Range';
import Position from './Position';
import EventEmitter from './EventEmitter';
import Terminal from './Terminal';
import CodeAction from './CodeAction';
import CodeActionKind from './CodeActionKind';
import * as extensions from './extensions';
import { URI, Utils } from 'vscode-uri';
import ThemeIcon from './ThemeIcon';
import TreeItem from './TreeItem';
import workspace from './workspace';
import window from './window';
import commands from './commands';
import * as env from './env';

enum UIKind {
  Desktop = 'Desktop',
  Web = 'Web',
}

enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

const MockVSCode = {
  EventEmitter,
  Terminal,
  TextDocument,
  Range,
  Position,
  CodeAction,
  CodeActionKind,
  extensions,
  Uri: { ...URI, ...Utils },
  workspace,
  window,
  commands,
  StatusBarAlignment,
  env,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  UIKind,
};

class mockTelemetry {}

mockery.registerMock('vscode', MockVSCode);
mockery.registerMock('vscode-extension-telemetry', mockTelemetry);
mockery.enable({ warnOnUnregistered: false });

export default MockVSCode;
