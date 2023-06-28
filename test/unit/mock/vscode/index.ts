import mockery from 'mockery';

import EventEmitter from './EventEmitter';
import * as extensions from './extensions';
import { URI, Utils } from 'vscode-uri';
import workspace from './workspace';
import window from './window';
import commands from './commands';

const MockVSCode = {
  EventEmitter,
  extensions,
  Uri: { ...URI, ...Utils },
  workspace,
  window,
  commands,
  StatusBarAlignment: {
    Left: '',
  },
};

class mockTelemetry {}

mockery.registerMock('vscode', MockVSCode);
mockery.registerMock('vscode-extension-telemetry', mockTelemetry);
mockery.enable({ warnOnUnregistered: false });

export default MockVSCode;
