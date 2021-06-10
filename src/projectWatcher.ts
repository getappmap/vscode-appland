import * as vscode from 'vscode';
import { PathLike } from 'fs';
import AppMapAgent, { StatusResponse } from './agent/appMapAgent';
import LanguageResolver from './languageResolver';

function unreachable(msg: string | undefined): never {
  throw new Error(`Unreachable: ${msg}`);
}

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

export default class ProjectWatcher {
  private readonly frequencyMs: number;
  private readonly rootDirectory: PathLike;
  private agent?: AppMapAgent;
  private nextStatusTimer?: NodeJS.Timeout;
  private lastStatus?: StatusResponse;

  constructor(rootDirectory: PathLike, frequencyMs = 6000) {
    this.rootDirectory = rootDirectory;
    this.frequencyMs = frequencyMs;
  }

  /**
   * Begins the main status polling loop. If appropriate, this method will update or install the agent CLI and run the
   * project initialization command prior to the first tick.
   */
  async initialize(): Promise<void> {
    if (this.nextStatusTimer) {
      throw new Error('initialization has already occurred');
    }

    this.agent = await LanguageResolver.getAgent(this.rootDirectory);
    if (!this.agent) {
      throw new Error('no agent was found for this project type');
    }

    const installAction = await this.agent.install(this.rootDirectory);
    if (installAction === 'installed') {
      // TODO.
      // Send a telemetry event.
      // Progress milestones.
    }

    // Run an initital query of the project status to determine whether or not we need to initialize the project.
    const initialStatus = await this.agent.status(this.rootDirectory);
    if (!initialStatus.properties.config.present) {
      await this.agent.init(this.rootDirectory);
    }

    // Begin the main loop.
    this.queueTick(initialStatus);
  }

  /**
   * Logic for the main status polling loop. This method is called continuously at a frequency set by `frequencyMs`.
   */
  private async tick(): Promise<void> {
    if (!this.agent) {
      unreachable('attempted to tick with no available agent');
    }

    if (this.nextStatusTimer) {
      unreachable('tick was called outside of the main tick loop');
    }

    const status = await this.agent.status(this.rootDirectory);
    if (!status) {
      // We'll assume that this is an itermittent failure case. After all, the command had to have succeeded previously
      // in order to get this far. Re-queue the tick and try again later.
      this.queueTick();
      return;
    }

    // Begin comparing the results of this status report to the last good status report. We want to react to properties
    // which have changed between the two.
    const diff = new ObjectKeyDiff(
      this.lastStatus as Record<string, unknown> | undefined,
      (status as unknown) as Record<string, unknown>
    );

    diff
      .on('properties.config.present', () => {
        // Send a telemetry event.
      })
      .on('properties.config.valid', (value) => {
        // Send a telemetry event.
      })
      .on('properties.project.agentVersionProject', (newVal, oldVal) => {
        if (newVal === 'none') {
          // User has removed the dependency.
          // Send a telemetry event.
        } else if (oldVal === 'none') {
          // User has added the dependency.
          // Send a telemetry event.
        } else {
          // User has changed the dependency version.
          // Send a telemetry event.
        }
      });

    // Queue up the next tick to poll the status again at a later time.
    this.queueTick(status);
  }

  /**
   * Begin a timer to execute `tick`, the status polling logic.
   * @param currentStatus The current status held by the caller, to be used in the next tick as the previous status.
   */
  private queueTick(currentStatus?: StatusResponse): void {
    if (currentStatus) {
      this.lastStatus = currentStatus;
    }

    this.nextStatusTimer = setTimeout(() => {
      this.nextStatusTimer = undefined;
      this.tick();
    }, this.frequencyMs);
  }
}
