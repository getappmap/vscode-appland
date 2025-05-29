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
import window from './window';
import commands from './commands';
import * as env from './env';
import * as authentication from './authentication';

enum UIKind {
  Desktop = 'Desktop',
  Web = 'Web',
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
  TreeItem: class {},
  UIKind,
};

class mockTelemetry {}

mockery.registerMock('vscode', MockVSCode);
mockery.registerMock('vscode-extension-telemetry', mockTelemetry);
mockery.enable({ warnOnUnregistered: false });

export default MockVSCode;
