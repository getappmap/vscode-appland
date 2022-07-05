import { BrowserContext, ElectronApplication, Page, _electron as Electron } from '@playwright/test';
import { ConsoleReporter, downloadAndUnzipVSCode } from '@vscode/test-electron';
import * as path from 'path';

async function getElectronPath(installDirectory: string): Promise<string> {
  const os = process.platform;
  if (os === 'darwin') {
    return path.join(installDirectory, 'Electron');
  } else if (os === 'linux') {
    const product = await import(path.join(installDirectory, 'resources', 'app', 'product.json'));
    return path.join(installDirectory, product.applicationName);
  } else if (os === 'win32') {
    const product = await import(path.join(installDirectory, 'resources', 'app', 'product.json'));
    return path.join(installDirectory, `${product.nameShort}.exe`);
  } else {
    throw new Error(`Unsupported platform: ${os}`);
  }
}

export interface CodeHarness {
  app: ElectronApplication;
  page: Page;
  context: BrowserContext;
}

interface LaunchOptions {
  workspacePath?: string;
  verbose?: boolean;
}

export async function downloadCode(): Promise<string> {
  return await downloadAndUnzipVSCode({
    version: 'insiders',
    reporter: new ConsoleReporter(false),
  });
}

export async function launchCode(
  codePath: string,
  extensionDevelopmentPath: string,
  userDataDir: string,
  options: LaunchOptions
): Promise<CodeHarness> {
  const baseCodePath = path.join(codePath, '..');
  const executablePath = await getElectronPath(baseCodePath);
  const app = await Electron.launch({
    executablePath,
    args: [
      '--no-cached-data',
      '--disable-keytar',
      '--disable-crash-reporter',
      '--verbose',
      '--no-sandbox',
      '--disable-telemetry',
      '--disable-extensions',
      '--disable-updates',
      '--disable-gpu',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-workspace-trust',
      '--enable-smoke-test-driver',
      `--user-data-dir=${userDataDir}`,
      `--extensionDevelopmentPath=${extensionDevelopmentPath}`,
      options?.workspacePath || '',
    ],
    env: {
      ...process.env,
      APPMAP_TEST: '1',
    },
  });

  const context = app.context();
  const page = await app.firstWindow();

  if (options?.verbose) {
    page.on('console', (msg) => console.log(`Electron [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', (msg) => console.log(`Electron [error] ${msg}`));
    page.on('crash', () => console.log('Electron [error] PAGE CRASH'));
    page.on('close', () => console.log(`Electron [info] page has been closed`));
  }

  return { app, page, context };
}
