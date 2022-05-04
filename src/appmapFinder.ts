import * as vscode from 'vscode';

type Handler = (uri: vscode.Uri) => void;

export default function appmapFinder(onURI: Handler): void {
  vscode.workspace.findFiles('**/*.appmap.json', `**/node_modules/**`).then((uris) => {
    uris.forEach(onURI);
  });
}
