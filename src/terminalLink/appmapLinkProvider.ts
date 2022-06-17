import * as vscode from 'vscode';
import { bestFilePath } from '../lib/bestFilePath';

export class AppMapTerminalLink extends vscode.TerminalLink {
  constructor(
    public appMapFileName: string,
    startIndex: number,
    length: number,
    public eventId?: number
  ) {
    super(startIndex, length);
  }
}

export class AppMapTerminalLinkProvider implements vscode.TerminalLinkProvider {
  provideTerminalLinks(context: vscode.TerminalLinkContext): vscode.TerminalLink[] {
    const appmapLocations = context.line.match(/[^\s]+\.appmap\.json(:\d+)?/g);
    if (!appmapLocations) return [];

    return [...new Set(appmapLocations)].map((match) => {
      const startIndex = context.line.indexOf(match);
      const [appMapFileName, eventId] = match.split(':');
      return new AppMapTerminalLink(
        appMapFileName,
        startIndex,
        match.length,
        eventId ? Number(eventId) : undefined
      );
    });
  }

  async handleTerminalLink(link: AppMapTerminalLink): Promise<void> {
    const uri = await bestFilePath(link.appMapFileName);
    if (!uri) return;

    const state = {
      currentView: 'viewFlow',
    } as { currentView: string; selectedObject?: string };
    if (link.eventId) state.selectedObject = `event:${link.eventId}`;
    const fragment = JSON.stringify(state);
    vscode.commands.executeCommand('vscode.open', uri.with({ fragment }));
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function appmapLinkProvider(): void {
  const provider = new AppMapTerminalLinkProvider();
  vscode.window.registerTerminalLinkProvider(provider);
}
