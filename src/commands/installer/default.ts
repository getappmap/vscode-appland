import { Installer } from '.';
import * as vscode from 'vscode';

export default class DefaultInstaller implements Installer {
  protected createTerminal(
    cliCommand: string,
    projectPath: string,
    env?: { [key: string]: string | null | undefined }
  ) {
    const terminal = vscode.window.createTerminal({
      name: 'install-appmap',
      cwd: projectPath,
      env,
    });

    terminal.show();
    terminal.sendText(cliCommand);
  }

  async execute(
    cliCommand: string,
    projectPath: string,
    env?: { [key: string]: string | null | undefined }
  ): Promise<void> {
    this.createTerminal(cliCommand, projectPath, env);
  }

  // These variables must be present otherwise children classes cannot
  // override this method using this signature. Similarly, the return
  // type must be compatible.
  //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canInstall(_language: string, _projectPath: string): Promise<boolean> | boolean {
    return true;
  }
}
