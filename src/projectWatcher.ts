import * as vscode from 'vscode';
import { PathLike } from 'fs';
import { join } from 'path';
import AppMapAgent, { StatusResponse } from './agent/appMapAgent';
import LanguageResolver from './languageResolver';
import { createMilestones, MilestoneMap, MilestoneType } from './milestones';
import Telemetry, { Events } from './telemetry';
import {
  flagWorkspaceRecordedAppMap,
  hasWorkspaceFolderOpenedAppMap,
  hasWorkspaceFolderRecordedAppMap,
  unreachable,
} from './util';
import glob from 'glob';

function resolveFullyQualifiedKey(key: string, obj: Record<string, unknown>): unknown {
  const tokens = key.split(/\./);
  let iterObj = obj;

  for (;;) {
    if (!iterObj) {
      return undefined;
    }

    const token = tokens.shift();
    if (!token) {
      return iterObj;
    }

    iterObj = iterObj[token] as Record<string, unknown>;
  }
}

/**
 * A utility class that provides simplified object property comparisons.
 */
class ObjectKeyDiff {
  private readonly last: Record<string, unknown> | undefined;
  private readonly current: Record<string, unknown>;

  constructor(last: Record<string, unknown> | undefined, current: Record<string, unknown>) {
    this.last = last;
    this.current = current;
  }

  getValues(key: string): [unknown, unknown] | undefined {
    if (!this.last) {
      return undefined;
    }

    return [resolveFullyQualifiedKey(key, this.last), resolveFullyQualifiedKey(key, this.current)];
  }

  changed(key: string): boolean {
    return (
      this.last !== undefined &&
      resolveFullyQualifiedKey(key, this.last) !== resolveFullyQualifiedKey(key, this.current)
    );
  }

  valueChangedTo(key: string, value: unknown): boolean {
    return this.changed(key) && this.current[key] === value;
  }

  /**
   * Receive a callback if the value of `key` differs.
   * @param key The key to be compared in both objects
   * @param callback If the values differ, a callback to receive both values
   */
  on(key, callback: (newVal: unknown, oldVal: unknown) => void): ObjectKeyDiff {
    const values = this.getValues(key);

    if (values) {
      if (values[0] !== values[1]) {
        callback(values[1], values[0]);
      }
    }

    return this;
  }
}

interface ProjectWatcherState {
  onEnter?(project: ProjectWatcher): void;
  onExit?(project: ProjectWatcher): void;
  tick(
    project: ProjectWatcher,
    agent: AppMapAgent,
    lastStatus?: StatusResponse
  ): Promise<StatusResponse | undefined>;
}

const State = {
  WAIT_FOR_AGENT_INSTALL: new (class implements ProjectWatcherState {
    onEnter(project: ProjectWatcher) {
      project.milestones.INSTALL_AGENT.setState('incomplete');
    }
    onExit(project: ProjectWatcher) {
      project.milestones.INSTALL_AGENT.setState('complete');
    }
    async tick(project: ProjectWatcher, agent: AppMapAgent): Promise<StatusResponse | undefined> {
      const isInstalled = await agent.isInstalled(project.rootDirectory);
      if (!isInstalled) {
        return undefined;
      }

      let initialStatus: StatusResponse | undefined;
      try {
        initialStatus = await agent.status(project.rootDirectory);
        const { config } = initialStatus.properties;
        if (config.present) {
          project.milestones.CREATE_CONFIGURATION.setState(config.valid ? 'complete' : 'error');
        }
      } catch (e) {
        // It's likely the user has an incompatible version of the agent. An upgrade will need to be performed.
        project.milestones.INSTALL_AGENT.setState('error');
        return undefined;
      }

      project.setState(State.WATCH_PROJECT_STATUS);
      return initialStatus;
    }
  })(),
  WATCH_PROJECT_STATUS: new (class implements ProjectWatcherState {
    private appmapWatcher?: vscode.FileSystemWatcher;

    onEnter(project: ProjectWatcher) {
      if (project.appmapExists()) {
        return;
      }

      this.appmapWatcher = vscode.workspace.createFileSystemWatcher(
        '**/*.appmap.json',
        false,
        true,
        true
      );

      this.appmapWatcher.onDidCreate((uri) => {
        if (uri.fsPath.startsWith(project.rootDirectory as string)) {
          flagWorkspaceRecordedAppMap(project.context, project.workspaceFolder);
          project.forceNextTick();

          this.appmapWatcher?.dispose();
          this.appmapWatcher = undefined;
        }
      });
    }

    onExit(project: ProjectWatcher) {
      Telemetry.sendEvent(Events.PROJECT_CLIENT_AGENT_REMOVE, {
        rootDirectory: project.rootDirectory,
      });

      this.appmapWatcher?.dispose();
      this.appmapWatcher = undefined;
    }

    async tick(
      project: ProjectWatcher,
      agent: AppMapAgent,
      lastStatus?: StatusResponse
    ): Promise<StatusResponse | undefined> {
      const isInstalled = await agent.isInstalled(project.rootDirectory);
      if (!isInstalled) {
        project.setState(State.WAIT_FOR_AGENT_INSTALL);
        return;
      }

      const status = await agent.status(project.rootDirectory);
      if (!status) {
        project.setState(State.WAIT_FOR_AGENT_INSTALL);
        return;
      }

      // Begin comparing the results of this status report to the last good status report. We want to react to properties
      // which have changed between the two.
      const diff = new ObjectKeyDiff(
        lastStatus as Record<string, unknown> | undefined,
        (status as unknown) as Record<string, unknown>
      );

      diff
        .on('properties.config.present', (isPresent) => {
          // Send a telemetry event.
          Telemetry.sendEvent(Events.PROJECT_CONFIG_WRITE, {
            rootDirectory: project.rootDirectory,
          });

          if (!isPresent) {
            project.milestones.CREATE_CONFIGURATION.setState('incomplete');
          }
        })
        .on('properties.config.valid', (isValid) => {
          if (isValid) {
            project.milestones.CREATE_CONFIGURATION.setState('complete');
          } else if (status.properties.config.present) {
            project.milestones.CREATE_CONFIGURATION.setState('error');
          }
        });

      if (await project.appmapExists()) {
        project.milestones.RECORD_APPMAP.setState('complete');
      }

      if (project.appmapOpened()) {
        project.milestones.VIEW_APPMAP.setState('complete');
      }

      return status;
    }
  })(),
};

export default class ProjectWatcher {
  private readonly frequencyMs: number;
  public readonly workspaceFolder: vscode.WorkspaceFolder;
  public readonly milestones: MilestoneMap;
  public readonly context: vscode.ExtensionContext;
  private _language?: string;
  private agent?: AppMapAgent;
  private nextStatusTimer?: NodeJS.Timeout;
  private lastStatus?: StatusResponse;
  private currentState: ProjectWatcherState;
  private _appmapExists?: boolean;
  private _appmapOpened?: boolean;

  constructor(
    context: vscode.ExtensionContext,
    workspaceFolder: vscode.WorkspaceFolder,
    frequencyMs = 6000
  ) {
    this.context = context;
    this.workspaceFolder = workspaceFolder;
    this.frequencyMs = frequencyMs;
    this.milestones = createMilestones(this);
    this.currentState = State.WAIT_FOR_AGENT_INSTALL;
  }

  get rootDirectory(): PathLike {
    return this.workspaceFolder.uri.fsPath;
  }

  setState(state: ProjectWatcherState) {
    if (this.currentState.onExit) {
      this.currentState.onExit(this);
    }

    this.currentState = state;

    if (this.currentState.onEnter) {
      this.currentState.onEnter(this);
    }
  }

  async performMilestoneAction(id: MilestoneType): Promise<void> {
    if (!this.language || !this.agent) {
      throw new Error(`unsupported project type ${this.language ? `(${this.language})` : ''}`);
    }

    switch (id) {
      case 'INSTALL_AGENT':
        await this.agent.install(this.rootDirectory);
        this.forceNextTick();
        break;

      case 'CREATE_CONFIGURATION':
        await this.agent.init(this.rootDirectory);
        this.forceNextTick();
        break;

      case 'RECORD_APPMAP':
        await this.agent.test(this.rootDirectory);
        break;

      default:
      // Do nothing
    }
  }

  appmapExists(): boolean {
    if (this._appmapExists) {
      return true;
    }

    this._appmapExists = hasWorkspaceFolderRecordedAppMap(this.context, this.workspaceFolder);

    return this._appmapExists;
  }

  appmapOpened(): boolean {
    if (this._appmapOpened) {
      return true;
    }

    this._appmapOpened = hasWorkspaceFolderOpenedAppMap(this.context, this.workspaceFolder);

    return this._appmapOpened;
  }

  /**
   * Begins the main status polling loop. If appropriate, this method will update or install the agent CLI and run the
   * project initialization command prior to the first tick.
   */
  async initialize(): Promise<void> {
    if (this.nextStatusTimer) {
      throw new Error('initialization has already occurred');
    }

    Telemetry.sendEvent(Events.PROJECT_OPEN, { rootDirectory: this.rootDirectory });

    this.language = await LanguageResolver.getLanguage(this.rootDirectory);
    if (!this.agent) {
      const languageDistribution = await LanguageResolver.getLanguageDistribution(
        this.rootDirectory
      );
      throw new Error(
        `no agent was found for this project type (${this.language}):\n${JSON.stringify(
          languageDistribution,
          null,
          2
        )}`
      );
    }

    // Begin the main loop
    this.tick();
  }

  /**
   * Logic for the main status polling loop. This method is called continuously at a frequency set by `frequencyMs`.
   */
  private async tick(): Promise<void> {
    let status: StatusResponse | undefined;

    try {
      if (!this.agent) {
        unreachable('attempted to tick with no available agent');
      }

      if (this.nextStatusTimer) {
        unreachable('tick was called outside of the main tick loop');
      }

      status = await this.currentState.tick(this, this.agent, this.lastStatus);
    } catch (exception) {
      Telemetry.sendEvent(Events.DEBUG_EXCEPTION, { exception });
    } finally {
      this.queueNextTick(status);
    }
  }

  /**
   * Begin a timer to execute `tick`, the status polling logic.
   * @param currentStatus The current status held by the caller, to be used in the next tick as the previous status.
   */
  private queueNextTick(currentStatus?: StatusResponse): void {
    if (currentStatus) {
      this.lastStatus = currentStatus;
    }

    this.nextStatusTimer = setTimeout(() => {
      this.nextStatusTimer = undefined;
      this.tick();
    }, this.frequencyMs);
  }

  public forceNextTick(): void {
    if (this.nextStatusTimer) {
      clearTimeout(this.nextStatusTimer);
      this.nextStatusTimer = undefined;
    }

    this.tick();
  }

  set language(language: string | undefined) {
    this._language = language;
    this.agent = language ? LanguageResolver.getAgentForLanguage(language) : undefined;
  }

  get language(): string | undefined {
    return this._language;
  }
}
