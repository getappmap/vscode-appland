import * as vscode from 'vscode';
import * as path from 'path';
import svgPending from '../../web/static/media/tree/pending.svg';
import { ProjectStateServiceInstance } from '../services/projectStateService';
import InstallGuideWebView from '../webviews/installGuideWebview';
import AnalysisManager from '../services/analysisManager';

export const ProjectPicker = 'project-picker';
export const RecordAppMaps = 'record-appmaps';

export const DocsPages = [
  {
    id: ProjectPicker,
    title: 'Add AppMap to your project',
    completion: 'agentInstalled',
  },
  {
    id: RecordAppMaps,
    title: 'Record AppMaps',
    completion: 'appMapsRecorded',
  },
  {
    id: 'open-appmaps',
    title: 'Explore AppMaps',
    completion: 'appMapOpened',
  },
  {
    id: 'investigate-findings',
    title: 'Runtime Analysis',
    completion: 'investigatedFindings',
  },
] as const;

type DocPage = (typeof DocsPages)[number];
export type DocPageId = DocPage['id'];

const icons = {
  lock: new vscode.ThemeIcon('lock'),
  unknown: new vscode.ThemeIcon('circle-large-outline'),
  pending: path.join(__dirname, svgPending),
  done: new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('terminal.ansiGreen')),
};

export class InstructionsTreeDataProvider implements vscode.TreeDataProvider<DocPage> {
  public onDidChangeTreeData?: vscode.Event<void>;
  private projectState?: ProjectStateServiceInstance;
  private completion = new Map<DocPageId, boolean | undefined>();

  constructor(
    context: vscode.ExtensionContext,
    protected readonly projectStates: ProjectStateServiceInstance[]
  ) {
    if (projectStates.length === 1) {
      [this.projectState] = projectStates;
      const emitter = new vscode.EventEmitter<void>();
      context.subscriptions.push(emitter);
      this.onDidChangeTreeData = emitter.event;
      this.projectState.onStateChange(() => emitter.fire(), null, context.subscriptions);
      AnalysisManager.onAnalysisToggled(() => emitter.fire(), null, context.subscriptions);
    }
  }

  public getTreeItem({ title, id }: DocPage): vscode.TreeItem {
    const item = new vscode.TreeItem(title);
    item.command = {
      title,
      command: InstallGuideWebView.command,
      arguments: [id],
    };
    item.iconPath = this.getIcon(id);

    return item;
  }

  getIcon(id: DocPageId): string | vscode.ThemeIcon {
    switch (this.completion.get(id)) {
      case true:
        return icons.done;
      case false:
        return icons.pending;
      default:
        return icons.unknown;
    }
  }

  public getChildren(): DocPage[] {
    const metadata = this.projectState?.metadata;

    if (!metadata) this.completion.clear();
    else
      this.completion = new Map(DocsPages.map(({ id, completion }) => [id, metadata[completion]]));

    return [...DocsPages];
  }
}
