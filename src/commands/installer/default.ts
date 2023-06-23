import { Installer } from '.';
import * as vscode from 'vscode';
import * as Terminals from './terminals';

export default class DefaultInstaller implements Installer {
  protected createTerminal(
    projectPath: string,
    env?: { [key: string]: string | null | undefined }
  ): vscode.Terminal {
    return Terminals.register(
      vscode.window.createTerminal({
        name: `AppMap installer (${projectPath})`,
        cwd: projectPath,
        env,
      })
    );
  }

  async execute(
    cliCommand: string,
    projectPath: string,
    env?: { [key: string]: string | null | undefined }
  ): Promise<void> {
    const terminal =
      Terminals.getMatching(projectPath, env) || this.createTerminal(projectPath, env);
    terminal.show();
    terminal.sendText(cliCommand);
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
