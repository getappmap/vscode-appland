import assert from 'assert';
import { exec, spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import * as fse from 'fs-extra';
import glob from 'glob';
import { basename, join } from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import * as vscode from 'vscode';
import AppMapService from '../../src/appMapService';
import { CodeObjectEntry } from '../../src/lib/CodeObjectEntry';
import { touch } from '../../src/lib/touch';

export const FixtureDir = join(__dirname, '../../../test/fixtures');
export const ProjectRuby = join(__dirname, '../../../test/fixtures/workspaces/project-ruby');
export const ProjectA = join(__dirname, '../../../test/fixtures/workspaces/project-a');
export const ProjectUptodate = join(
  __dirname,
  '../../../test/fixtures/workspaces/project-uptodate'
);

const PROJECTS = [ProjectA, ProjectUptodate];

export async function withTmpDir(fn: (tmpDir: string) => void | Promise<void>): Promise<void> {
  const tmpDir = await promisify(tmp.dir)();
  let createdByUs = false;

  try {
    await fs.access(tmpDir);
  } catch (e) {
    await fs.mkdir(tmpDir);
    createdByUs = true;
  }

  await fn(tmpDir);

  if (createdByUs) await fs.rmdir(tmpDir);
}

export const ExampleAppMap = join(
  ProjectA,
  'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
);
export const ExampleAppMapIndexDir = join(
  ProjectA,
  'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON'
);

export const APP_SERVICES_TIMEOUT = 30000;

export type DiagnosticForUri = {
  uri: vscode.Uri;
  diagnostics: vscode.Diagnostic[];
};

export async function repeatUntil(
  fn: () => void | void[] | Promise<void> | Promise<void | void[]>,
  message: string,
  test: () => boolean | Promise<boolean>
): Promise<void> {
  const actionInterval = setInterval(fn, 1000);

  try {
    await waitFor(message, test);
  } finally {
    clearInterval(actionInterval);
  }
}

function makeDiagnosticForUri(d: [vscode.Uri, vscode.Diagnostic[]]): DiagnosticForUri {
  return {
    uri: d[0],
    diagnostics: d[1],
  };
}

export function printCodeObject(
  buffer: string[],
  depth: number,
  codeObject: CodeObjectEntry
): string[] {
  buffer.push(['  '.repeat(depth), codeObject.fqid].join(''));
  codeObject.children.forEach(printCodeObject.bind(null, buffer, depth + 1));
  return buffer;
}

export function diagnosticAppMap(diagnostic: vscode.Diagnostic): string | undefined {
  return (diagnostic.relatedInformation || []).find((r) =>
    r.location.uri.fsPath.endsWith('.appmap.json')
  )?.location.uri.fsPath;
}

export function getDiagnostics(): DiagnosticForUri[] {
  return vscode.languages.getDiagnostics().map(makeDiagnosticForUri);
}

export function getDiagnosticsForAppMap(appMapFilePath: string): DiagnosticForUri[] {
  return vscode.languages
    .getDiagnostics()
    .map(makeDiagnosticForUri)
    .filter((ds) => ds.diagnostics.find((d) => diagnosticAppMap(d) === appMapFilePath));
}

export function hasDiagnostics(): boolean {
  return getDiagnostics().filter((d: DiagnosticForUri) => d.diagnostics.length > 0).length > 0;
}

export function hasNoDiagnostics(): boolean {
  return !hasDiagnostics();
}

export async function initializeWorkspace(): Promise<void> {
  await closeAllEditors();
  await cleanWorkspace();
}

export async function waitForIndexer(): Promise<void> {
  const appmapFiles = (await vscode.workspace.findFiles(`**/*.appmap.json`)).map(
    (uri) => uri.fsPath
  );
  const touchAppMaps = async () => Promise.all(appmapFiles.map((filePath) => touch(filePath)));
  await repeatUntil(
    touchAppMaps,
    `mtime files not created for all AppMaps`,
    async () => (await mtimeFiles()).length === appmapFiles.length
  );
}

export async function restoreFile(filePath: string, workspaceDir = ProjectA): Promise<void> {
  // note: git checkout filePath doesn't work here since it doesn't replace the file atomically
  // which is currently required for the indexer to work correctly
  const dstPath = join(ProjectA, filePath);
  const tmpPath = dstPath + '.orig';
  await executeWorkspaceOSCommand(`git show HEAD:./${filePath} > ${tmpPath}`, workspaceDir);
  await fs.rename(tmpPath, dstPath);
}

/**
 * Touches a file, then waits for appmap services to react.
 * @param touchFile file to touch
 * @returns current state of services
 */
export async function waitForAppMapServices(touchFile: string): Promise<AppMapService> {
  const appMapService = await waitForExtension();
  const wsPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const pidPath = join(wsPath, 'tmp', 'appmap', 'index.pid');
  // Make sure the indexer is all the way up before we ask it to do anything.
  try {
    await waitFor('Indexer starting', async () => {
      const touchPath = join(wsPath, 'appmap.yml');
      await touch(touchPath);
      return fse.existsSync(pidPath);
    });
  } catch (e) {
    const wsFiles = glob.sync(`${vscode.workspace.workspaceFolders![0].uri.fsPath}/**`);
    console.log(`wsFiles: ${JSON.stringify(wsFiles, null, 2)}`);
    console.log(e);
    throw e;
  }

  let repeater: NodeJS.Timeout | undefined = setInterval(
    async () => await restoreFile(touchFile),
    500
  );

  assert(appMapService.classMap, `Expected classMap service to be available`);
  assert(appMapService.findings, `Expected findings service to be available`);
  const services = [appMapService.classMap, appMapService.findings];

  return await new Promise<AppMapService>((resolve, reject) => {
    let completionCount = 0;

    const succeeded = (serviceName: string) => {
      if (!repeater) return;

      console.log(`Service ${serviceName} is available`);
      completionCount += 1;

      if (completionCount === services.length) {
        clearInterval(repeater);
        repeater = undefined;
        resolve(appMapService);
      }
    };
    const failed = () => {
      if (!repeater) return;

      reject(`classMap and findings services are not available`);
    };

    appMapService.classMap?.onChanged(succeeded.bind(null, 'classMap'));
    appMapService.findings?.onChanged(succeeded.bind(null, 'findings'));
    setTimeout(failed, APP_SERVICES_TIMEOUT);
  });
}

async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}

export async function executeWorkspaceOSCommand(cmd: string, workspaceName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    exec(cmd, { cwd: workspaceName }, (err, stdout, stderr) => {
      if (err) {
        console.log(stdout);
        console.warn(stderr);
        return reject(err);
      }
      resolve();
    });
  });
}

async function cleanWorkspace(): Promise<void> {
  async function cleanProject(project: string) {
    const commands = [`git checkout HEAD .`, `git clean -fd .`];
    for (const command of commands) {
      try {
        await executeWorkspaceOSCommand(command, project);
      } catch (e) {
        console.log(e);
      }
    }
  }
  for (const project of PROJECTS) {
    await cleanProject(project);
  }
}

export async function waitForExtension(): Promise<AppMapService> {
  await waitFor(
    `Extension not available`,
    () => !!vscode.extensions.getExtension('appland.appmap')
  );
  await waitFor(
    `Extension not active`,
    () => !!vscode.extensions.getExtension('appland.appmap')?.isActive
  );

  const extension = vscode.extensions.getExtension('appland.appmap');
  assert(extension);
  return extension.exports;
}

export async function waitFor(
  message: string,
  test: () => boolean | Promise<boolean>,
  timeout = 30000
): Promise<void> {
  const startTime = Date.now();
  let delay = 100;
  console.log(`Waiting because: ${message}`);
  while (!(await test())) {
    const elapsed = Date.now() - startTime;
    if (elapsed > timeout) {
      throw new Error(message);
    }

    delay = delay * 2;
    console.log(`Waiting ${delay}ms because: ${message}`);
    await wait(delay);
  }
}

export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function mtimeFiles(): Promise<vscode.Uri[]> {
  return vscode.workspace.findFiles(`**/mtime`);
}

export async function appmapFiles(): Promise<vscode.Uri[]> {
  return vscode.workspace.findFiles(`**/*.appmap.json`);
}
