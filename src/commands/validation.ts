import * as vscode from 'vscode';
import { promisify } from 'util';
import { join } from 'path';
import { glob } from 'glob';
import { existsSync } from 'fs';

export async function ensureAppMapsExist(appmapDir: string): Promise<boolean> {
  const appmapFiles = await promisify(glob)(join(appmapDir, '**/*.appmap.json'));
  if (appmapFiles.length === 0) {
    vscode.window.showInformationMessage(
      `No AppMaps found in ${appmapDir}. Record some AppMaps and then try this command again.`
    );
    return false;
  }

  return true;
}

export async function ensureCurrentAppMapsExist(cwd: string): Promise<boolean> {
  if (!existsSync(join(cwd, '.appmap', 'current'))) {
    vscode.window.showInformationMessage(
      `.appmap/current directory does not exist. Use the command 'AppMap: Restore AppMap Archive' to create it`
    );
    return false;
  }

  return true;
}
