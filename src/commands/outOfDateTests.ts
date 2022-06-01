import * as vscode from 'vscode';
import { AppmapUptodateService } from '../services/appmapUptodateService';

const COPY_TO_CLIPBOARD = 'Copy test names to clipboard';

let testCommand = 'DISABLE_SPRING=true APPMAP=true bundle exec rails test';

async function obtainOutOfDateTests(
  uptodateService: AppmapUptodateService
): Promise<{ workspace: vscode.WorkspaceFolder; filePaths: string[] } | undefined> {
  async function selectWorkspace(): Promise<vscode.WorkspaceFolder | undefined> {
    if (vscode.workspace.workspaceFolders?.length === 0) return;
    if (vscode.workspace.workspaceFolders?.length === 1) {
      return vscode.workspace.workspaceFolders[0];
    } else {
      return await vscode.window.showWorkspaceFolderPick();
    }
  }

  const workspace = await selectWorkspace();
  if (workspace === undefined) return;

  const filePaths = (await uptodateService.outOfDateTestFileUris())
    .filter((testUri) => testUri.fsPath.startsWith(workspace.uri.fsPath))
    .map((testUri) => testUri.fsPath.slice(workspace.uri.fsPath.length + 1));

  if (filePaths.length === 0) {
    vscode.window.showInformationMessage(
      `AppMap: No tests results are out of date in ${workspace.name}`
    );
    return;
  }

  return { workspace, filePaths };
}

export async function runOutOfDateTests(
  context: vscode.ExtensionContext,
  uptodateService: AppmapUptodateService
): Promise<void> {
  const statusBarItem = vscode.window.createStatusBarItem('appmap.outOfDateTests');
  statusBarItem.name = 'Out of date tests';
  uptodateService.onUpdated(async () => {
    const count = (await uptodateService.outOfDateTestFileUris()).length;
    if (count > 0) {
      statusBarItem.text = `${count} out of date`;
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  });

  context.subscriptions.push(statusBarItem);

  async function perform() {
    const outOfDate = await obtainOutOfDateTests(uptodateService);
    if (!outOfDate) return;

    const commandStr = await vscode.window.showInputBox({
      title: 'Enter test command',
      value: testCommand,
    });
    if (!commandStr) return;
    testCommand = commandStr;

    // TODO: shell-escape
    const command = [commandStr].concat(...outOfDate.filePaths);
    if (!vscode.window.activeTerminal) {
      const terminalOptions = {} as vscode.TerminalOptions;
      terminalOptions.cwd = outOfDate.workspace.uri;
      vscode.window.createTerminal(terminalOptions);
    }
    vscode.window.activeTerminal?.sendText(command.join(' '));
  }

  context.subscriptions.push(vscode.commands.registerCommand('appmap.runOutOfDateTests', perform));
}

export async function copyOutOfDateTestsToClipboard(
  context: vscode.ExtensionContext,
  uptodateService: AppmapUptodateService
): Promise<void> {
  async function perform() {
    const outOfDate = await obtainOutOfDateTests(uptodateService);
    if (!outOfDate) return;

    const copyToClipboard = async () => {
      vscode.env.clipboard.writeText(outOfDate.filePaths.join(' '));
    };

    vscode.window
      .showInformationMessage(
        `${outOfDate.filePaths.length} test files are out of date`,
        {
          modal: false,
        },
        { title: COPY_TO_CLIPBOARD, action: copyToClipboard }
      )
      .then(async (selection) => {
        if (!selection) return;

        return selection.action();
      });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.copyOutOfDateTestsToClipboard', perform)
  );
}
