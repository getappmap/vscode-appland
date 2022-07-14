import { readFile } from 'fs';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { ClassMapEntry, CodeObjectEntry, CodeObjectEntryRootType } from './CodeObjectEntry';

const ROOT_ID = '<root>';

const betterNames = {
  'database Database': 'Queries',
  'HTTP server request': 'Route',
};

export async function buildClassMap(
  classMapFileURLs: Set<string>,
  resolveFolder: (uri: vscode.Uri) => vscode.WorkspaceFolder | undefined
): Promise<{ codeObjectByFqid: Record<string, CodeObjectEntry>; classMap: CodeObjectEntry[] }> {
  const codeObjectByFqid: Record<string, CodeObjectEntry> = {};

  const mergeCodeObject = (
    folder: vscode.WorkspaceFolder,
    appMapFilePath: string,
    parent: CodeObjectEntry,
    cme: ClassMapEntry
  ) => {
    cme = normalizeClassMapEntry(cme);
    const child = parent.findOrMergeChild(folder, appMapFilePath, cme);
    codeObjectByFqid[child.fqid] = child;
    (cme.children || []).forEach(mergeCodeObject.bind(null, folder, appMapFilePath, child));
  };

  function normalizeClassMapEntry(cme: ClassMapEntry): ClassMapEntry {
    cme.labels = cme.labels || [];
    cme.children = cme.children || [];
    const betterName = betterNames[[cme.type, cme.name].join(' ')];
    if (betterName) cme.name = betterName;

    let result = cme;
    if (cme.type === CodeObjectEntryRootType.PACKAGE) {
      {
        // Some code object entries have a path-delimited package name, but we want
        // each package name token to be its own object.
        const chain = cme.name.split('/').map(
          (name: string) =>
            ({
              folder: cme.folder,
              type: cme.type,
              name: name,
              static: cme.static,
              location: cme.location,
              children: [],
              labels: [],
            } as ClassMapEntry)
        );
        chain.forEach((item, index) => {
          if (index > 0) {
            chain[index - 1].children = [item];
          }
        });
        chain[chain.length - 1].labels = cme.labels;
        chain[chain.length - 1].children = cme.children;
        result = chain[0];
      }
    }

    return result;
  }

  function makeFolder(cme: ClassMapEntry): ClassMapEntry {
    cme = normalizeClassMapEntry(cme);
    let result = cme;
    if (cme.type === CodeObjectEntryRootType.PACKAGE) {
      result = {
        folder: cme.folder,
        type: CodeObjectEntryRootType.FOLDER,
        name: 'Code',
        static: false,
        location: cme.location,
        children: [normalizeClassMapEntry(cme)],
        labels: [],
      } as ClassMapEntry;
    }
    return result;
  }

  const root = new CodeObjectEntry(
    {} as vscode.WorkspaceFolder,
    undefined,
    ROOT_ID,
    CodeObjectEntryRootType.FOLDER,
    'root'
  );
  await Promise.all(
    [...classMapFileURLs]
      .map((urlStr) => vscode.Uri.parse(urlStr, true))
      .map(async (classMapFileURL) => {
        let classMapData: Buffer;
        try {
          classMapData = await promisify(readFile)(classMapFileURL.fsPath);
        } catch (e) {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          if ((e as any).code !== 'ENOENT') console.warn(e);
          return;
        }

        const folder = resolveFolder(classMapFileURL);
        if (!folder) {
          console.warn(`No workspace folder for ${classMapFileURL.fsPath}`);
          return;
        }

        let classMap: ClassMapEntry[];
        try {
          classMap = JSON.parse(classMapData.toString());
        } catch (e) {
          // Malformed JSON file. This is logged because classMap files should be written atomically.
          console.warn(e);
          return;
        }

        if (!classMap) {
          console.log(`ClassMap from ${classMapFileURL} is falsey`);
          return;
        }

        const classMapFileTokens = classMapFileURL.fsPath.split('/');
        classMapFileTokens.pop();
        const indexDir = classMapFileTokens.join('/');
        const appMapFilePath = [indexDir, 'appmap.json'].join('.');
        classMap.map(makeFolder).forEach(mergeCodeObject.bind(null, folder, appMapFilePath, root));
      })
  );
  // The classMap loader in @appland/models will build code objects for events whose
  // proper code object is missing from the classMap. They will appear as new root elements,
  // which is confusing in the UI. We just drop them here.
  const classMap = root.children
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    .filter((child) => Object.values(CodeObjectEntryRootType).includes(child.type as any))
    .map((child) => {
      child.finalize();
      return child;
    });

  return { codeObjectByFqid, classMap };
}
