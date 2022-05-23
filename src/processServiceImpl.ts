import { assert } from 'console';
import { AppMapProcessService, Invocation } from './appMapService';
import Command from './services/command';

export default class ProcessServiceImpl implements AppMapProcessService {
  private _invocations: Invocation[] = [];

  get invocations(): Invocation[] {
    return this._invocations;
  }

  startInvocation(command: Command): void {
    this._invocations.push({ command, messages: [] });
  }

  addMessage(message: string): void {
    assert(this._invocations.length > 0, `No invocation started`);
    this._invocations[this._invocations.length - 1].messages.push(message);
  }

  endInvocation(exitCode: number): void {
    assert(this._invocations.length > 0, `No invocation started`);
    assert(this._invocations[this._invocations.length - 1].exitCode === undefined);
    this._invocations[this._invocations.length - 1].exitCode = exitCode;
  }
}
