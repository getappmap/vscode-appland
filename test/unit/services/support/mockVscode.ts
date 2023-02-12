import mockery from 'mockery';
import MockEventEmitter from './MockEventEmitter';
mockery.registerMock('vscode', {
  EventEmitter: MockEventEmitter,
});
mockery.enable({ warnOnUnregistered: false });
