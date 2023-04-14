import mockery from 'mockery';

import EventEmitter from './EventEmitter';
import * as extensions from './extensions';
import { URI, Utils } from 'vscode-uri';
import * as workspace from './workspace';

const MockVSCode = {
  EventEmitter,
  extensions,
  Uri: { ...URI, ...Utils },
  workspace,
};

mockery.registerMock('vscode', MockVSCode);
mockery.enable({ warnOnUnregistered: false });

export default MockVSCode;
