import mockery from 'mockery';

import EventEmitter from './EventEmitter';
import * as extensions from './extensions';
import { URI } from 'vscode-uri';

const MockVSCode = {
  EventEmitter,
  extensions,
  Uri: URI,
};

mockery.registerMock('vscode', MockVSCode);
mockery.enable({ warnOnUnregistered: false });

export default MockVSCode;
