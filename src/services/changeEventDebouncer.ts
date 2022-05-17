import * as vscode from 'vscode';

export default class ChangeEventDebouncer<T> extends vscode.EventEmitter<T> {
  timeout?: NodeJS.Timeout;

  static readonly DefaultDebounceTime = 250;

  constructor(public debounceTime = ChangeEventDebouncer.DefaultDebounceTime) {
    super();
  }

  fire(data: T): void {
    this.queueData(data);
  }

  queueData(data: T): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
    this.timeout = setTimeout(() => {
      super.fire(data);
    }, this.debounceTime);
  }
}
