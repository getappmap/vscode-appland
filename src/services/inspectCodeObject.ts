import { spawn } from 'child_process';
import * as vscode from 'vscode';
import Command from './command';

export type InspectResult = {
  ancestors: string[];
  callers: string[];
  classTrigrams: string[];
  functionTrigrams: string[];
  packageTrigrams: string[];
  httpServerRequests: string[];
  returnValues: string[];
  sqlQueries: string[];
  sqlTables: string[];
};

class Inspector {
  constructor(public folder: vscode.WorkspaceFolder, public fqid: string) {}

  async inspect(): Promise<InspectResult> {
    const args = ['appmap', 'inspect', this.fqid];
    const command = await Command.commandArgs(this.folder, args, {});

    const response: string[] = [];
    const process = spawn(command.mainCommand, command.args, command.options);
    return new Promise<InspectResult>((resolve, reject) => {
      process.once('exit', (code) => {
        if (code === 0) return resolve(JSON.parse(response.join()) as InspectResult);
        reject(code);
      });

      if (!process.stdout) {
        console.log(`No stdout for ${command.mainCommand}`);
        return reject(-1);
      }
      process.stdout.setEncoding('utf8');
      process.stdout.on('data', (data) => {
        response.push(data);
      });
    });
  }
}

export default async function inspectCodeObject(
  folder: vscode.WorkspaceFolder,
  fqid: string
): Promise<InspectResult> {
  const inspector = new Inspector(folder, fqid);
  return await inspector.inspect();
}
