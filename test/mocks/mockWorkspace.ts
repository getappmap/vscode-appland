import { SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import * as temp from 'temp';
import * as fs from 'fs';

function stubWorkspaces(sinon: SinonSandbox, languageExtension = 'rb', numProjects = 3): void {
  const workspaceName = 'mockWorkspace';
  const workspaces = Array.from(Array(numProjects), (_, i) =>
    temp.mkdirSync(`${workspaceName}-${i}`)
  );

  workspaces.forEach((dir) => {
    fs.writeFileSync(`${dir}/mockSource.${languageExtension}`, '');
  });

  sinon.stub(vscode.workspace, 'workspaceFolders').value(
    workspaces.map((dir, i) => ({
      index: i,
      name: `${workspaceName}-${i}`,
      uri: vscode.Uri.file(dir),
    }))
  );

  sinon.stub(vscode.workspace, 'getWorkspaceFolder').callsFake((uri: vscode.Uri) => {
    return vscode.workspace.workspaceFolders?.find((folder) => folder.uri.path === uri.path);
  });
}

export function mockSingleProjectWorkspace(sinon: SinonSandbox, languageExtension = 'rb'): void {
  stubWorkspaces(sinon, languageExtension, 1);
}

export function mockMultiProjectWorkspace(
  sinon: SinonSandbox,
  languageExtension: 'rb',
  numProjects = 3
): void {
  stubWorkspaces(sinon, languageExtension, numProjects);
}
