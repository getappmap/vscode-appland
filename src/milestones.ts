import * as vscode from 'vscode';
import ProjectWatcher from './projectWatcher';
import Telemetry, { Events } from './telemetry';

type CompletionState = 'complete' | 'incomplete' | 'error';

interface MilestoneDefinition {
  id: string;
  label: string;
  state: CompletionState;
}

const MILESTONES = Object.freeze({
  INSTALL_AGENT: {
    label: 'Install AppMap agent',
    state: 'incomplete' as CompletionState,
  },
  CREATE_CONFIGURATION: {
    label: 'Configure AppMap',
    state: 'incomplete' as CompletionState,
  },
  RECORD_APPMAP: {
    label: 'Record AppMaps',
    state: 'incomplete' as CompletionState,
  },
  VIEW_APPMAP: {
    label: 'Open an AppMap',
    state: 'incomplete' as CompletionState,
  },
});

export type MilestoneType = keyof typeof MILESTONES;
export type MilestoneMap = Record<MilestoneType, Milestone>;

export function createMilestones(project: ProjectWatcher): MilestoneMap {
  return Object.entries(MILESTONES).reduce((memo, [id, definition]) => {
    memo[id] = new Milestone(project, { id, ...definition } as MilestoneDefinition);
    return memo;
  }, {} as MilestoneMap);
}

export default class Milestone implements MilestoneDefinition {
  public readonly project: ProjectWatcher;
  private readonly onChangeStateEmitter: vscode.EventEmitter<Milestone> = new vscode.EventEmitter();
  public readonly onChangeState = this.onChangeStateEmitter.event;
  public readonly id: string;
  public readonly label: string;
  protected _state: CompletionState;

  constructor(project: ProjectWatcher, definition: MilestoneDefinition) {
    this.project = project;
    this.id = definition.id;
    this.label = definition.label;
    this._state = definition.state;
  }

  get state(): CompletionState {
    return this._state;
  }

  setState(state: CompletionState): void {
    if (state === this._state) {
      return;
    }

    this._state = state;
    this.onChangeStateEmitter.fire(this);
    Telemetry.sendEvent(Events.MILESTONE_CHANGE_STATE, {
      rootDirectory: this.project.rootDirectory,
      milestone: this,
    });
  }
}
