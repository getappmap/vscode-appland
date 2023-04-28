import * as vscode from 'vscode';

type HandlerFunction = (uri: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder) => void;

export default interface FileChangeHandler {
  onCreate: HandlerFunction;
  onChange: HandlerFunction;
  onDelete: HandlerFunction;
}
