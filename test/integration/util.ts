import * as vscode from 'vscode';
import { exec, ExecException } from 'child_process';
import { join } from 'path';
import assert from 'assert';
import AppMapService from '../../src/appMapService';
import { touch } from '../../src/lib/touch';
import AutoScannerService from '../../src/services/autoScanner';
import ProcessService from '../../src/services/processService';

export const FixtureDir = join(__dirname, '../../../test/fixtures');
export const ProjectRuby = join(__dirname, '../../../test/fixtures/workspaces/project-ruby');
export const ProjectA = join(__dirname, '../../../test/fixtures/workspaces/project-a');
export const ProjectWithEchoCommand = join(
  __dirname,
  '../../../test/fixtures/workspaces/project-with-echo-command'
);
export const ProjectUptodate = join(
  __dirname,
  '../../../test/fixtures/workspaces/project-uptodate'
);

const PROJECTS = [ProjectA, ProjectWithEchoCommand, ProjectUptodate];

export const ExampleAppMap = join(
  ProjectA,
  'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
);
export const ExampleAppMapIndexDir = join(
  ProjectA,
  'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON'
);

export const APP_SERVICES_TIMEOUT = 10000;

export type DiagnosticForUri = {
  uri: vscode.Uri;
  diagnostics: vscode.Diagnostic[];
};

export async function repeatUntil(
  fn: () => Promise<void | void[]>,
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

export async function closeWorkspace(): Promise<void> {
  const appMapService = await waitForExtension();
  const catchNoProcess = async (cmd: string, msg?: string): Promise<void> => {
    try {
      if (msg) {
        console.log(msg);
      }
      await executeWorkspaceOSCommand(cmd, ProjectA);
    } catch (e) {
      // code 1 means no matching process, ignore
      if ((e as ExecException).code !== 1) {
        console.log(`${JSON.stringify(e)}`);
        console.log(e);
      }
    }
  };

  const pgrep = 'ps -ef | grep';
  await catchNoProcess(`${pgrep} 'run appmap index'`, 'before kill');
  await catchNoProcess(`pkill -f 'run appmap index'`);
  await catchNoProcess(`${pgrep} 'run appmap index'`, 'after disposing');

  await catchNoProcess(`${pgrep} 'run scanner scan'`, 'before disposing');
  await catchNoProcess(`pkill -f 'run scanner scan'`);
  await catchNoProcess(`${pgrep} 'run scanner scan'`, 'after disposing');

  await initializeWorkspace();
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

export async function waitForAppMapServices(touchFile: string): Promise<AppMapService> {
  const appMapService = await waitForExtension();

  let repeater: NodeJS.Timeout | undefined = setInterval(
    () => executeWorkspaceOSCommand(`git show HEAD:./${touchFile} > ./${touchFile}`, ProjectA),
    500
  );

  return new Promise<AppMapService>((resolve, reject) => {
    const complete = (): boolean => {
      if (!repeater) return false;

      clearInterval(repeater);
      repeater = undefined;
      return true;
    };

    const succeeded = () => {
      if (!complete()) return;
      resolve(appMapService);
    };
    const failed = () => {
      if (!complete()) return;
      reject();
    };

    appMapService.classMap?.onChanged(succeeded);
    appMapService.findings?.onChanged(succeeded);
    setTimeout(failed, APP_SERVICES_TIMEOUT);
  });
}

async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}

export async function executeWorkspaceOSCommand(cmd: string, workspaceName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    exec(cmd, { cwd: workspaceName }, (err, stdout, stderr) => {
      console.log(stdout);
      console.warn(stderr);
      if (err) {
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
