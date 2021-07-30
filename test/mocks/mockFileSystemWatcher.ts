import { FileSystemWatcher, Event, EventEmitter, Uri } from 'vscode';

export default class MockFileSystemWatcher implements FileSystemWatcher {
  ignoreCreateEvents = true;
  ignoreChangeEvents = true;
  ignoreDeleteEvents = true;

  emitterOnDidCreate = new EventEmitter<Uri>();
  emitterOnDidChange = new EventEmitter<Uri>();
  emitterOnDidDelete = new EventEmitter<Uri>();

  onDidCreate = this.emitterOnDidCreate.event;
  onDidChange = this.emitterOnDidChange.event;
  onDidDelete = this.emitterOnDidDelete.event;

  dispose(): void {
    this.emitterOnDidCreate.dispose();
    this.emitterOnDidChange.dispose();
    this.emitterOnDidDelete.dispose();
  }
}
