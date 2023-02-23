import mockery from 'mockery';
import EventEmitter from './EventEmitter';
mockery.registerMock('vscode', {
  EventEmitter,
});
mockery.enable({ warnOnUnregistered: false });
