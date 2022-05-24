import * as vscode from 'vscode';

type HandlerFunction = (uri: vscode.Uri) => void;

export default interface FileChangeHandler {
  onCreate: HandlerFunction;
  onChange: HandlerFunction;
  onDelete: HandlerFunction;
}
