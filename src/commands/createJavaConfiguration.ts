import * as vscode from 'vscode';
import { writeFile } from 'fs/promises';
import { dump as toYaml } from 'js-yaml';
import * as path from 'path';
import { fileExists } from '../util';

export enum NodeKind {
  Project = 2,
  PackageRoot = 3,
  Package = 4,
}

export interface INodeData {
  name: string;
  path?: string;
  handlerIdentifier?: string;
  uri?: string;
  kind: NodeKind;
}

interface IPackageDataParam {
  projectUri?: string;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function getProjects(workspaceFolder: vscode.Uri): Promise<INodeData[]> {
  return vscode.commands.executeCommand('java.project.list', workspaceFolder.toString());
}

async function getPackageData(
  nodeData: IPackageDataParam[],
  filterKind?: NodeKind
): Promise<INodeData[]> {
  const packageData = (await Promise.all(
    nodeData.map((data) => vscode.commands.executeCommand('java.getPackageData', data))
  )) as INodeData[][];
  return packageData.flat().filter(({ kind }) => !filterKind || kind === filterKind);
}

export default function createJavaConfigurationCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    'appmap.createConfiguration',
    async (workspaceFolder?: vscode.WorkspaceFolder) => {
      let selectedWorkspaceFolder = workspaceFolder;
      if (!selectedWorkspaceFolder) {
        if (vscode.workspace.workspaceFolders?.length === 1) {
          [selectedWorkspaceFolder] = vscode.workspace.workspaceFolders;
        } else {
          selectedWorkspaceFolder = await vscode.window.showWorkspaceFolderPick({
            placeHolder: 'Select a workspace folder to create an AppMap configuration for',
          });
        }
      }

      if (!selectedWorkspaceFolder) return;

      const configPath = path.join(selectedWorkspaceFolder.uri.fsPath, 'appmap.yml');
      if (await fileExists(configPath)) {
        const overwrite = await vscode.window.showWarningMessage(
          'An AppMap configuration already exists. Overwrite?',
          'Yes',
          'No'
        );
        if (overwrite !== 'Yes') return;
      }

      const javaExtension = vscode.extensions.getExtension('redhat.java');
      if (!javaExtension?.isActive) {
        await javaExtension?.activate();
      }

      let projects = await getProjects(selectedWorkspaceFolder.uri);
      if (projects.length > 1) {
        const selectedProjects = await vscode.window.showQuickPick(
          projects.map(({ name, uri }) => ({ label: name, uri })),
          { canPickMany: true, placeHolder: 'Select projects to include AppMap configurations for' }
        );
        projects = projects.filter(({ uri }) => selectedProjects?.some((p) => p.uri === uri));
      }

      const packages = new Set<string>();
      for (const project of projects) {
        const packageRoots = await getPackageData(
          [{ kind: NodeKind.Project, projectUri: project.uri }],
          NodeKind.PackageRoot
        );

        const projectPackages = await getPackageData(
          packageRoots.map(({ kind, uri, handlerIdentifier }) => ({
            kind,
            projectUri: project.uri,
            rootPath: uri,
            handlerIdentifier,
            isHeirarchicalView: false,
          })),
          NodeKind.Package
        );

        projectPackages.forEach(({ name }) => packages.add(name));
      }

      await writeFile(
        path.join(selectedWorkspaceFolder.uri.fsPath, 'appmap.yml'),
        toYaml({
          app: selectedWorkspaceFolder.name,
          language: 'java',
          appmap_dir: 'tmp/appmap',
          packages: [...packages].map((pkg) => ({ path: pkg })),
        })
      );

      const result = await vscode.window.showInformationMessage(
        `AppMap configuration created at ${configPath}`,
        'OK',
        'Open'
      );

      if (result === 'Open') vscode.window.showTextDocument(vscode.Uri.file(configPath));
    }
  );
}
