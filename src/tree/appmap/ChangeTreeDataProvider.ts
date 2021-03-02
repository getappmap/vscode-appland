import * as vscode from 'vscode';
import AppMapDescriptor from '../../appmapDescriptor';
import { canonicalize } from '@appland/appmap';
import * as yaml from 'js-yaml';
import { diffLines } from 'diff';
import { extend } from 'vue/types/umd';

async function buildLookupTable(
  descriptors: Promise<AppMapDescriptor[]> | null
): Promise<Map<string, AppMapDescriptor>> {
  const lookup = new Map();
  (await descriptors)?.forEach((d) => {
    if (!d.metadata?.name || !d.metadata?.fingerprints) {
      return;
    }

    lookup[d.metadata.name as string] = d;
  });
  return lookup;
}

async function canonicalizeAppMap(
  algorithm: string,
  descriptor: AppMapDescriptor
): Promise<string> {
  const canonicalForm = canonicalize(algorithm, await descriptor.loadAppMap());
  return yaml.dump(canonicalForm) as string;
}
class AppMapDifference {
  public algorithm: string;
  public base: AppMapDescriptor | null;
  public working: AppMapDescriptor | null;

  constructor(
    algo: string,
    base: AppMapDescriptor | null,
    working: AppMapDescriptor | null
  ) {
    this.algorithm = algo;
    this.base = base;
    this.working = working;
  }

  public async getChange(): Promise<vscode.TreeItem | null> {
    if (!this.base && !this.working) {
      return Promise.resolve(null);
    }

    if (!this.base && this.working) {
      const name = this.working.metadata?.name as string;
      return Promise.resolve({
        label: `added: ${name}`,
        tooltip: name,
        command: {
          title: 'open',
          command: 'vscode.open',
          arguments: [this.working.resourceUri],
        },
      });
    }

    if (this.base && !this.working) {
      const name = this.base.metadata?.name as string;
      return Promise.resolve({
        label: `removed: ${name}`,
        tooltip: name,
        command: {
          title: 'open',
          command: 'vscode.open',
          arguments: [this.base.resourceUri],
        },
      });
    }

    if (!this.base || !this.working) {
      // We should never get here, but it keeps the TS compiler happy
      return Promise.resolve(null);
    }

    // const baseDoc = await canonicalizeAppMap(this.algorithm, this.base);
    // const workingDoc = await canonicalizeAppMap(this.algorithm, this.working);
    // const changes = diffLines(baseDoc, workingDoc);

    const name = this.working.metadata?.name as string;
    return Promise.resolve({
      label: `changed: ${name}`,
      tooltip: name,
      command: {
        title: 'open',
        command: 'vscode.diff',
        arguments: [this.base.resourceUri, this.working.resourceUri],
      },
    });
  }
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

export class ChangeTreeDataProvider
  implements vscode.TreeDataProvider<vscode.TreeItem> {
  private baseDescriptors: Promise<AppMapDescriptor[]> | null;
  private workingDescriptors: Promise<AppMapDescriptor[]> | null;

  constructor(
    baseDescriptors: Promise<AppMapDescriptor[]> | null,
    workingDescriptors: Promise<AppMapDescriptor[]>
  ) {
    this.baseDescriptors = baseDescriptors;
    this.workingDescriptors = workingDescriptors;
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public async findChangeSet(algorithm: string): Promise<vscode.TreeItem[]> {
    if (!this.workingDescriptors) {
      return Promise.resolve([]);
    }

    const result: vscode.TreeItem[] = [];
    const baseLookup = await buildLookupTable(this.baseDescriptors);
    return Promise.all(
      (await this.workingDescriptors)
        .map(async (working) => {
          if (!working.metadata?.name || !working.metadata?.fingerprints) {
            return null;
          }

          const name: string = working.metadata.name as string;
          const base = baseLookup[name];
          if (!base) {
            const diff = new AppMapDifference(algorithm, null, working);
            return await diff.getChange();
          }

          const baseFingerprint = base.metadata.fingerprints.find(
            (fingerprint) =>
              fingerprint.canonicalization_algorithm === algorithm
          );

          const fingerprints: Record<string, string>[] = working.metadata
            .fingerprints as Record<string, string>[];
          const workingFingerprint = fingerprints.find(
            (fingerprint) =>
              fingerprint.canonicalization_algorithm === algorithm
          );

          if (!baseFingerprint || !workingFingerprint) {
            console.warn(`No ${algorithm} fingerprint found on AppMap ${name}`);
            return null;
          }

          if (baseFingerprint.digest !== workingFingerprint.digest) {
            const diff = new AppMapDifference(algorithm, base, working);
            return await diff.getChange();
          }

          return null;
        })
        .filter(Boolean)
    ).then((items) => items.filter(notEmpty));
  }

  public getChildren(): Thenable<vscode.TreeItem[]> {
    return this.findChangeSet('beta_v1_info');
  }
}
