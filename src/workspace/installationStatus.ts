import * as vscode from 'vscode';
import { ProjectStateServiceInstance } from '../services/projectStateService';

export default class InstallationStatusBadge {
  protected watcher?: vscode.Disposable;
  private resolver?: (value?: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor(private readonly viewId: string) {}

  initialize(projectStates: ProjectStateServiceInstance[]): void {
    if (projectStates.length === 0) {
      return this.markAsComplete();
    }

    const installableProjects: ProjectStateServiceInstance[] = [];
    for (const projectState of projectStates) {
      if (projectState.installable) {
        installableProjects.push(projectState);
      }
    }

    if (installableProjects.length > 1) {
      // Skip the badge if there are multiple installable projects. What we really want is to show the number of
      // installable projects, but that's not possible with the current API.
      return this.markAsComplete();
    }

    // We're down to one installable project. Show the badge.
    const project: ProjectStateServiceInstance | undefined = installableProjects[0];
    if (!project) {
      // No installable targets. We've nothing to do.
      return this.markAsComplete();
    }

    // Render the badge, and watch for updates. `watch` will update the badge state later on if the project state
    // changes.
    this.renderProjectState(project);
    return this.watch(project);
  }

  markAsPending(): void {
    if (this.resolver) {
      return;
    }

    vscode.window.withProgress({ location: { viewId: this.viewId } }, () => {
      return new Promise((resolve) => {
        this.resolver = resolve;
      });
    });
  }

  markAsComplete(): void {
    if (this.resolver) {
      this.resolver();
    }

    this.resolver = undefined;
  }

  private renderProjectState(project: ProjectStateServiceInstance): void {
    if (project.complete) {
      this.markAsComplete();
    } else {
      this.markAsPending();
    }
  }

  // Wait for the project state to change and attempt to update the badge.
  watch(project: ProjectStateServiceInstance): void {
    if (!this.watcher) {
      this.watcher = project.onStateChange(() => this.renderProjectState(project));
    }
  }

  dispose(): void {
    if (this.watcher) {
      this.watcher.dispose();
    }
  }
}
