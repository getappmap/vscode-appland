import mockery from 'mockery';

import TextDocument from './TextDocument';
import Range from './Range';
import Position from './Position';
import Selection from './Selection';
import EventEmitter from './EventEmitter';
import Terminal from './Terminal';
import CodeAction from './CodeAction';
import CodeActionKind from './CodeActionKind';
import * as extensions from './extensions';
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

const MockVSCode = {
  authentication,
  EventEmitter,
  Terminal,
  TextDocument,
  Range,
  Position,
  Selection,
  CodeAction,
  CodeActionKind,
  extensions,
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
